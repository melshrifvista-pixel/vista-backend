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

  // For development, we'll use a mock if credentials are missing
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('-----------------------------------------');
    console.log(`[MOCK EMAIL SENT] Attempt: ${attempt + 1}`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-----------------------------------------');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 465,
    secure: (process.env.SMTP_PORT || 465) == 465,
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
        // Log to a fallback system or DB in production
        console.error(`[EMAIL] Max retries reached for ${options.to}`);
        throw err;
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

module.exports = sendEmail;

