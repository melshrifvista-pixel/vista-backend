const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testFlow() {
  try {
    const timestamp = Date.now();
    const testUser = {
      username: `testuser_${timestamp}`,
      password: 'Password123!',
      fullName: 'Test User',
      email: `test_${timestamp}@example.com`
    };

    console.log('Testing Registration...');
    const regRes = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('Registration Response:', regRes.data);

    console.log('Testing Login (should fail if unverified)...');
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        username: testUser.username,
        password: testUser.password
      });
    } catch (e) {
      console.log('Login failed as expected:', e.response.data);
    }

    console.log('Flow test complete.');
  } catch (err) {
    console.error('Test failed:', err.response ? err.response.data : err.message);
  }
}

testFlow();
