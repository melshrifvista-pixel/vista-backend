const sendEmail = require('./src/utils/email');

async function test() {
  try {
    await sendEmail({
      to: 'melshrif.vista@gmail.com',
      subject: 'VISTA - Test OTP',
      text: 'This is a test OTP: 123456',
      html: '<h1>Test OTP</h1><p>123456</p>'
    });
    console.log('Email sent successfully!');
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

test();
