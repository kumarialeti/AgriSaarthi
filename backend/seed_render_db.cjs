const { Client } = require('pg');

const dbUrl = 'postgresql://agrisaarthi_user:cOq91KVeKfdm1FrtoLpulLUoTJRkkSr3@dpg-dabhfdcs728c739u6vvg-a.oregon-postgres.render.com/agrisaarthi?ssl=true';

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    await client.connect();
    console.log('Connected for seeding...');

    // Crops
    const crops = [
      ['Paddy', 'వరి', 'धान', 'Kharif/Rabi', '120-150 days'],
      ['Cotton', 'పత్తి', 'कपास', 'Kharif', '150-180 days'],
      ['Chilli', 'మిరప', 'मिर्च', 'Kharif/Rabi', '150-160 days'],
      ['Maize', 'మొక్కజొన్న', 'मक्का', 'Kharif/Rabi', '90-110 days'],
      ['Tomato', 'టమాటా', 'टमाटर', 'All seasons', '100-120 days']
    ];

    for (let c of crops) {
      await client.query(`
        INSERT INTO crops (name_en, name_te, name_hi, season)
        VALUES ($1, $2, $3, $4)
      `, [c[0], c[1], c[2], c[3]]);
    }
    console.log('Crops seeded.');

    // Govt Schemes
    const schemes = [
      ['PM-KISAN', 'పిఎం కిసాన్', 'Direct income support of ₹6,000 per year for farmers.', 'Farmers holding cultivable land', 'https://pmkisan.gov.in/'],
      ['Rythu Bandhu', 'రైతు బంధు', 'Investment support for agriculture (₹5,000 per acre/season) in Telangana.', 'Land-owning farmers in Telangana', 'http://rythubandhu.telangana.gov.in/'],
      ['PMFBY', 'ఫసల్ బీమా యోజన', 'Crop insurance scheme covering yield losses.', 'All farmers growing notified crops', 'https://pmfby.gov.in/']
    ];

    for (let s of schemes) {
      await client.query(`
        INSERT INTO government_schemes (name_en, name_te, benefits_en, eligibility_en, application_url)
        VALUES ($1, $2, $3, $4, $5)
      `, s);
    }
    console.log('Schemes seeded.');

  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
