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
        const receiver_email = email_val;
        console.log(receiver_email);

        

        const email_subject = 'Regarding Your Assignment Submission';

const email_body = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Valid Submission</title>
</head>
<body>
  <p>Dear Student,</p>
  <p>We have received your submission for Assignment ${assignmentId}.</p>
  <ul>
    <li><strong>Submission URL:</strong> ${submissionUrl}</li>
    <li><strong>Number of Submissions:</strong> ${noOfSubmissions}</li>
  </ul>
  <p>Thank you for your participation.</p>
  <p>Best regards,<br>${sender_email}</p>
</body>
</html>
`;

const email_body2 = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Submission</title>
</head>
<body>
  <p>Dear Student,</p>
  <p>We regret to inform you that your submission for Assignment ${assignmentId} is not valid.</p>
  <ul>
    <li><strong>Submission URL:</strong> ${submissionUrl}</li>
    <li><strong>Number of Submissions:</strong> ${noOfSubmissions}</li>
  </ul>
  <p>Please review your submission and make necessary corrections.</p>
  <p>Best regards,<br>${sender_email}</p>
</body>
</html>
`;
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



