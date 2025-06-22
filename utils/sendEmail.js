// utils/sendEmail.js
import nodemailer from 'nodemailer';

const sendEmail = async ({ to, subject, text }) => {
  const transporter = nodemailer.createTransport({
    service: 'yahoo', // or 'gmail'
    auth: {
      user: process.env.YAHOO_USER,
      pass: process.env.YAHOO_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.YAHOO_USER,
    to,
    subject,
    text,
  });
};

export default sendEmail;
