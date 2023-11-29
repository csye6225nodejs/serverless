import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import atob from 'atob';
import AWS from "aws-sdk";
import formData from 'form-data';
import Mailgun from 'mailgun.js';

AWS.config.update({ region: process.env.AWS_REGION_DETAILS });
const docClient = new AWS.DynamoDB.DocumentClient();
const storage = new Storage({ credentials: JSON.parse(atob(process.env.GOOGLE_CREDENTIALS)) });
const bucketName = process.env.BUCKET_NAME;
var fileName = 'uploaded-file.zip';

const DOMAIN = process.env.MAILGUN_DOMAIN;
const API_KEY = process.env.MAILGUN_API_KEY;
const mailgun = new Mailgun(formData);
const client = mailgun.client({ username: 'api', key: API_KEY });

export const handler = async (event, context) => {
    try {


        console.log(event.Records[0].Sns.Message);
        const snsMessage = JSON.parse(event.Records[0].Sns.Message);
        console.log("snsMessage"+snsMessage);

        const submissionUrl = snsMessage.submissionDetails.submission_url;
        const assignmentId = snsMessage.submissionDetails.assignment_id;
        const submissionId = snsMessage.submissionDetails.id;
        console.log(assignmentId);
        const email_val = snsMessage.emailId;
        const noOfSubmissions = snsMessage.noOfSubmissions;
        console.log(email_val);
        fileName = `${assignmentId}_${submissionId}_${email_val}.zip`;
        console.log("Sns message"+snsMessage);
        console.log("submission URL"+submissionUrl);
        // Download the ZIP file from the submission URL
        
        const zipFileBuffer = await downloadZipFile(submissionUrl);

        var zipexists = 1;
        if (zipFileBuffer) {
            console.log('Downloaded ZIP file successfully:', zipFileBuffer);
        } else {
            console.log('Failed to download ZIP file or the file is empty.');
            zipexists = 0;
        }
        // Upload the ZIP file to Google Cloud Storage
        if(zipexists===1)
        {
            await storage.bucket(bucketName).file(fileName).save(zipFileBuffer);
            console.log('ZIP file uploaded to Google Cloud Storage.');
        }

   

        const sender_email = process.env.SENDER_EMAIL;
        const receiver_email = 'tiruchunapalli.a@northeastern.edu';
        console.log(receiver_email);

        const email_subject = 'Regarding your assignment submission';
        const email_body = `The submission url ${submissionUrl} for Assignment: ${assignmentId} and no of times you have submitted is ${noOfSubmissions} `;
        const email_body2 = `The submission url ${submissionUrl} for Assignment: ${assignmentId} is not valid and no of times you have submitted is ${noOfSubmissions}`;
        //await sendMail(sender_email, receiver_email, email_subject, email_body, submissionUrl,2,assignmentId);
        if(zipexists === 0){
            console.log("in zip exists is wrong loop");
            const mailResponse = await sendMail(sender_email, receiver_email, email_subject, email_body2, submissionUrl, assignmentId,noOfSubmissions);
            console.log(mailResponse);
            console.log("After calling mailgun");

            const dynamoDBResponse = await updateDynamoDB(receiver_email, submissionUrl, noOfSubmissions, submissionId);
            console.log(dynamoDBResponse);
            console.log("after dynamodb put function");
            return;
        }
        const mailResponse = await sendMail(sender_email, receiver_email, email_subject, email_body, submissionUrl, assignmentId,noOfSubmissions);
        console.log(mailResponse);
        console.log("After calling mailgun");
        
        const dynamoDBResponse = await updateDynamoDB(receiver_email, submissionUrl, noOfSubmissions, submissionId);
        console.log(dynamoDBResponse);
        console.log("after dynamodb put function");


    } catch (error) {
        console.error(`Error processing SNS message: ${error.message}`);
    }
};

const downloadZipFile = async (url) => {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
        });

        const contentType = response.headers["content-type"];
        console.log(contentType+"Content Type");
        if(contentType && contentType.toLowerCase().includes("zip")){
            return response.data;
        } else {
            return null;
        }
    } catch (error) {
        throw new Error(`Error downloading ZIP file: ${error.message}`);
    }
};

const updateDynamoDB = (email, submissionUrl, submissionCount, submissionId) => {
    const TableName = process.env.DYNAMODB_TABLE_NAME;
    console.log("In dynamodb function");
    const params = {
        TableName: TableName,
        Item: {
            email,
            submissionCount,
            submissionUrl,
            submissionId
        }
    };
    console.log("before dynamodb put function");
    return docClient.put(params).promise();
}

const sendMail = (sender_email, receiver_email, email_subject, email_body, url, id, count) => {
    console.log("In sendMail function");
    const data = {
        from: sender_email,
        to: receiver_email,
        subject: email_subject,
        text: email_body,
    };
    console.log("before send call");
    return client.messages.create(DOMAIN, data);
};



