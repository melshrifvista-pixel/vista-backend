const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const maxRetries = 3;
  let attempt = 0;

  const smtpUser = process.env.SMTP_USER || 'melshrif.vista@gmail.com';
  const fromEmail = process.env.FROM_EMAIL && process.env.FROM_EMAIL !== 'no-reply@vista.local' 
    ? process.env.FROM_EMAIL 
    : smtpUser;

  const message = {
    from: `"${process.env.FROM_NAME || 'VISTA Financial'}" <${fromEmail}>`,
    replyTo: smtpUser,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  console.log(`[EMAIL_DEBUG] Preparing to send email to: ${options.to}`);
  console.log(`[EMAIL_DEBUG] SMTP Config: HOST=${process.env.SMTP_HOST || 'smtp.gmail.com'}, PORT=${process.env.SMTP_PORT || 465}, USER=${process.env.SMTP_USER || 'melshrif.vista@gmail.com'}`);

  // Always use real SMTP - Gmail App Password hardcoded as fallback
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'melshrif.vista@gmail.com',
      pass: process.env.SMTP_PASS || 'mxjz xjix znls yqev',
    },
    debug: true, // Enable nodemailer debug logs
    logger: true // Log to console
  });

  console.log(`[EMAIL_DEBUG] Transporter created. Verifying connection...`);
  try {
    const isVerified = await transporter.verify();
    console.log(`[EMAIL_DEBUG] Transporter connection verified: ${isVerified}`);
  } catch (verifyErr) {
    console.error(`[EMAIL_DEBUG] Transporter verification failed:`, verifyErr);
  }

  while (attempt < maxRetries) {
    try {
      console.log(`[EMAIL_DEBUG] Attempt ${attempt + 1}: Calling transporter.sendMail...`);
      const info = await transporter.sendMail(message);
      console.log(`[EMAIL_DEBUG] Sent successfully to ${options.to}. MessageId: ${info.messageId}`);
      return;
    } catch (err) {
      attempt++;
      console.error(`[EMAIL_DEBUG] Attempt ${attempt} failed.`);
      console.error(`[EMAIL_DEBUG] Error name: ${err.name}, message: ${err.message}`);
      console.error(`[EMAIL_DEBUG] Full error stack:`, err);
      
      if (attempt >= maxRetries) {
        console.error(`[EMAIL_DEBUG] Max retries reached for ${options.to}. Throwing error.`);
        throw err;
      }
      console.log(`[EMAIL_DEBUG] Waiting before retry...`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

module.exports = sendEmail;
