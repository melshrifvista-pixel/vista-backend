const https = require('https');

const data = JSON.stringify({
  username: 'nonexistent',
  password: 'wrong'
});

const options = {
  hostname: 'vista-backend-k7cm.onrender.com',
  port: 443,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
