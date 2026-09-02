const axios = require('axios');

async function testLive() {
  try {
    const backendUrl = 'https://agrisaarthi-backend.onrender.com';
    const aiUrl = 'https://agrisaarthi-ai.onrender.com';

    console.log('Testing Backend Health...');
    try {
      const res = await axios.get(`${backendUrl}/health`);
      console.log('Backend Health:', res.data);
    } catch (e) {
      console.error('Backend Health Failed:', e.message);
    }

    console.log('\nTesting AI Service Health...');
    try {
      const res = await axios.get(`${aiUrl}/health`);
      console.log('AI Service Health:', res.data);
    } catch (e) {
      console.error('AI Service Health Failed:', e.message);
    }

    console.log('\nTesting AI Service Chat...');
    try {
      const res = await axios.post(`${aiUrl}/ai/chat`, {
        message: "Hello",
        language: "en",
        context: {}
      });
      console.log('AI Chat:', res.data);
    } catch (e) {
      console.error('AI Chat Failed:', e.response?.status, e.response?.data || e.message);
    }

  } catch (err) {
    console.error(err);
  }
}

testLive();
