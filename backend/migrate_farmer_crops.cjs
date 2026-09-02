const { Client } = require('pg');

const dbUrl = 'postgresql://agrisaarthi_user:cOq91KVeKfdm1FrtoLpulLUoTJRkkSr3@dpg-dabhfdcs728c739u6vvg-a.oregon-postgres.render.com/agrisaarthi?ssl=true';

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    // Add missing columns to farmer_crops
    const queries = [
      'ALTER TABLE farmer_crops ADD COLUMN IF NOT EXISTS field_id UUID;',
      'ALTER TABLE farmer_crops ADD COLUMN IF NOT EXISTS variety VARCHAR(100);',
      'ALTER TABLE farmer_crops ADD COLUMN IF NOT EXISTS growth_stage VARCHAR(100);',
      'ALTER TABLE farmer_crops ADD COLUMN IF NOT EXISTS previous_crop VARCHAR(100);'
    ];
    
    for (const q of queries) {
      await client.query(q);
      console.log('Executed:', q);
    }
    
    console.log('Missing columns added to farmer_crops!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
