const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // For development, we'll use a mock if credentials are missing
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('-----------------------------------------');
    console.log(`[MOCK EMAIL SENT]`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message: ${options.text}`);
    console.log('-----------------------------------------');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  await transporter.sendMail(message);
};

module.exports = sendEmail;
