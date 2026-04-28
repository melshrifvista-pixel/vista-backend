const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'melshrif.vista@gmail.com',
    pass: 'mxjz xjix znls yqev'
  }

});

async function testEmail() {
  try {
    await transporter.sendMail({
      from: 'melshrif.vista@gmail.com',
      to: 'melshrif.vista@gmail.com',
      subject: 'VISTA SMTP Test',
      text: 'If you see this, SMTP is working!'
    });
    console.log('SUCCESS: Email sent!');
  } catch (err) {
    console.error('FAILURE: Email failed!');
    console.error(err.message);
  }
}

testEmail();
