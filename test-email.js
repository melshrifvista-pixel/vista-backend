require('dotenv').config();
const sendEmail = require('./src/utils/email');

async function testEmail() {
  try {
    console.log('Testing direct SMTP connection...');
    await sendEmail({
      to: 'melshrif.vista@gmail.com', // Sending to self to test
      subject: 'VISTA SMTP Test',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<p>This is a test email to verify SMTP configuration.</p>'
    });
    console.log('Test email script completed successfully.');
  } catch (err) {
    console.error('Test email script failed:', err);
  }
}

testEmail();
