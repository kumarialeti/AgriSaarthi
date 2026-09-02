const axios = require('axios');
const pg = require('pg');

const dbUrl = 'postgresql://agrisaarthi_user:cOq91KVeKfdm1FrtoLpulLUoTJRkkSr3@dpg-dabhfdcs728c739u6vvg-a.oregon-postgres.render.com/agrisaarthi?ssl=true';
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function testCrop() {
  try {
    await client.connect();
    // Get a real crop
    const cropsRes = await client.query('SELECT id FROM crops LIMIT 1');
    const realCropId = cropsRes.rows[0].id;
    console.log('Real Crop ID:', realCropId);

    const backendUrl = 'https://agrisaarthi-backend.onrender.com';
    const email = `testuser_${Date.now()}@test.com`;

    // 1. Register
    let res = await axios.post(`${backendUrl}/api/auth/register`, { email, password: 'TestUser@123', role: 'FARMER' });
    const token = res.data.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // 2. Profile
    await axios.put(`${backendUrl}/api/farmer/profile`, { full_name: 'Test Farmer' }, { headers });
    
    // 3. Crops POST
    try {
      res = await axios.post(`${backendUrl}/api/farmer/crops`, {
        crop_id: realCropId,
        acreage: 1,
        variety: '',
        growth_stage: '',
        previous_crop: '',
        sowing_date: '',
        expected_harvest_date: ''
      }, { headers });
      console.log('Crops POST SUCCESS:', res.data);
    } catch (e) {
      console.error('Crops POST FAILED:', e.response?.status, e.response?.data);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

testCrop();
