const fs = require('fs');
const pg = require('pg');

const dbUrl = 'postgresql://agrisaarthi_user:cOq91KVeKfdm1FrtoLpulLUoTJRkkSr3@dpg-dabhfdcs728c739u6vvg-a.oregon-postgres.render.com/agrisaarthi?ssl=true';

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    // Add missing columns to farmer_profiles
    const queries = [
      'ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);',
      'ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);',
      'ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farming_experience_years INT;',
      'ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farming_preference VARCHAR(255);'
    ];
    
    for (const q of queries) {
      await client.query(q);
      console.log('Executed:', q);
    }
    
    console.log('Missing columns added successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
