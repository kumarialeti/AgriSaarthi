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
    console.log('✅ Auth Register: SUCCESS');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Profile Create
    try {
      res = await axios.put(`${BACKEND_URL}/api/farmer/profile`, {
        full_name: 'Audit Farmer',
        phone: '9998887776',
        total_land_acres: '2.5',
        state: 'Andhra Pradesh',
        district: 'Guntur'
      }, { headers });
      console.log('✅ Farmer Profile Update: SUCCESS');
    } catch (e) {
      console.log('❌ Farmer Profile Update ERROR:', e.response?.status, e.response?.data);
    }

    // Fetch real crop ID
    let realCropId;
    try {
      const cropsRes = await axios.get(`${BACKEND_URL}/api/farmer/crops/all`, { headers });
      if (cropsRes.data.data && cropsRes.data.data.length > 0) {
        realCropId = cropsRes.data.data[0].id;
      }
    } catch (e) {
      console.log('Could not fetch master crops:', e.message);
    }

    // 3. Crops Add
    try {
      if (realCropId) {
        res = await axios.post(`${BACKEND_URL}/api/farmer/crops`, {
          crop_id: realCropId,
          acreage: 1,
          variety: 'Chilli 334',
          sowing_date: '',
          expected_harvest_date: ''
        }, { headers });
        console.log('✅ Farmer Crop Creation: SUCCESS');
      }
    } catch (e) {
      console.log('❌ Farmer Crop Creation ERROR:', e.response?.status, e.response?.data);
    }

    // 4. Soil Entry
    try {
      res = await axios.post(`${BACKEND_URL}/api/soil/manual`, {
        ph: 6.5,
        nitrogen_kg_ha: '',
        phosphorus_kg_ha: '',
        potassium_kg_ha: ''
      }, { headers });
      console.log('✅ Soil Manual Entry: SUCCESS');
    } catch (e) {
      console.log('❌ Soil Manual Entry ERROR:', e.response?.status, e.response?.data);
    }

    // 5. Chat Session & AI Response
    try {
      res = await axios.post(`${BACKEND_URL}/api/chat/sessions`, { language: 'en' }, { headers });
      const sessionId = res.data.data.id;
      res = await axios.post(`${BACKEND_URL}/api/chat/sessions/${sessionId}/messages`, {
        message: 'What is today chilli price in Guntur?'
      }, { headers });
      console.log('✅ AI Chat Response: SUCCESS');
    } catch (e) {
      console.log('❌ AI Chat Response ERROR:', e.response?.status, e.response?.data);
    }

    // 6. Weather API
    try {
      res = await axios.get(`${BACKEND_URL}/api/weather/district/Guntur/Andhra%20Pradesh`, { headers });
      console.log('✅ Weather API: SUCCESS');
    } catch (e) {
      console.log('❌ Weather API ERROR:', e.response?.status, e.response?.data);
    }

    // 7. Market Live API
    try {
      res = await axios.get(`${BACKEND_URL}/api/market/live?state=Andhra Pradesh&district=Guntur`, { headers });
      console.log('✅ Market Live API: SUCCESS (Data or Safe Fallback)');
    } catch (e) {
      console.log('❌ Market Live API ERROR:', e.response?.status, e.response?.data);
    }

  } catch (err) {
    console.log('Outer ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

test();
