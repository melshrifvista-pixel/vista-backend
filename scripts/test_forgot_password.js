const https = require('https');

function testEndpoint(path, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'vista-backend-k7cm.onrender.com',
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let respBody = '';
      res.on('data', (d) => respBody += d);
      res.on('end', () => resolve({ status: res.statusCode, body: respBody }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Testing /api/auth/forgot-password...');
  const result = await testEndpoint('/api/auth/forgot-password', {
    email: 'melshrif.vista@gmail.com'
  });
  console.log('Status:', result.status);
  console.log('Response:', result.body);
}

main();
