const axios = require('axios');

const BACKEND_URL = 'https://agrisaarthi-backend.onrender.com';

async function test() {
  try {
    const email = `testuser_${Date.now()}@test.com`;
    // 1. Register
    let res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      email,
      password: 'TestUser@123',
      role: 'FARMER'
    });
    const token = res.data.data.token;
    console.log('Registered & got token');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Profile
    try {
      await axios.get(`${BACKEND_URL}/api/farmer/profile`, { headers });
    } catch (e) {
      console.log('Profile GET:', e.response?.status); // Should be 404
    }

    // 3. Start Session
    res = await axios.post(`${BACKEND_URL}/api/chat/sessions`, { language: 'en' }, { headers });
    const sessionId = res.data.data.id;
    console.log('Started chat session:', sessionId);

    // 4. Send Message
    res = await axios.post(
      `${BACKEND_URL}/api/chat/sessions/${sessionId}/messages`,
      { message: 'My chilli leaves are turning yellow. What should I do?', language: 'en' },
      { headers }
    );
    console.log('Message Sent Success:', res.data);

  } catch (err) {
    console.log('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

test();
