const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"Tiara's Schedule" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    return false;
  }
};

module.exports = sendEmail;
