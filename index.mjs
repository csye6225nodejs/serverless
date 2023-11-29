import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import mailgun from 'mailgun-js';
import atob from 'atob';

const storage = new Storage({ credentials: JSON.parse(atob(process.env.GOOGLE_CREDENTIALS)) });
const bucketName = 'csye6225-fall2023';
const fileName = 'uploaded-file.zip';
const API_KEY = 'b47cf213c81e2ee1d4779f6c45bdfe51-30b58138-9e72675b';
const DOMAIN = 'abhishekvenkata.me';

const mg = mailgun({ apiKey: API_KEY, domain: DOMAIN });

export const handler = async (event, context) => {
    try {
        const snsMessage = JSON.parse(event.Records[0].sns.Message);
        const submissionUrl = snsMessage.submissionDetails.submission_url;

        // Download the ZIP file from the submission URL
        const zipFileBuffer = await downloadZipFile(submissionUrl);

        // Upload the ZIP file to Google Cloud Storage
        await storage.bucket(bucketName).file(fileName).save(zipFileBuffer);

        console.log('ZIP file uploaded to Google Cloud Storage.');

        const sender_email = 'abhishekvenkata.199715@gmail.com';
        const receiver_email = snsMessage.emailId;
        const email_subject = 'Regarding your assignment submission';
        const email_body = `The submission url ${submissionUrl} downloaded and saved to the db.`;

        sendMail(sender_email, receiver_email, email_subject, email_body);
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

        return response.data;
    } catch (error) {
        throw new Error(`Error downloading ZIP file: ${error.message}`);
    }
};

const sendMail = (sender_email, receiver_email, email_subject, email_body) => {
    const data = {
        from: sender_email,
        to: receiver_email,
        subject: email_subject,
        text: email_body,
    };

    mg.messages().send(data, (error, body) => {
        if (error) console.log(error);
        else console.log(body);
    });
};