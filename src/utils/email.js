const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const maxRetries = 3;
  let attempt = 0;

  const message = {
    from: `${process.env.FROM_NAME || 'VISTA Financial'} <${process.env.FROM_EMAIL || 'melshrif.vista@gmail.com'}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  // Always use real SMTP - Gmail App Password hardcoded as fallback
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'melshrif.vista@gmail.com',
      pass: process.env.SMTP_PASS || 'mxjz xjix znls yqev',
    },
  });

  while (attempt < maxRetries) {
    try {
      await transporter.sendMail(message);
      console.log(`[EMAIL] Sent successfully to ${options.to}`);
      return;
    } catch (err) {
      attempt++;
      console.error(`[EMAIL] Attempt ${attempt} failed: ${err.message}`);
      if (attempt >= maxRetries) {
        console.error(`[EMAIL] Max retries reached for ${options.to}`);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

module.exports = sendEmail;
