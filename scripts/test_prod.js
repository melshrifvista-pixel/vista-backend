const axios = require('axios');

async function testProd() {
  try {
    const res = await axios.post('https://vista-backend-k7cm.onrender.com/api/auth/login', {
      username: 'nonexistent',
      password: 'wrong'
    });
    console.log('Response:', res.data);
  } catch (err) {
    console.log('Status:', err.response.status);
    console.log('Error Data:', JSON.stringify(err.response.data, null, 2));
  }
}

testProd();
