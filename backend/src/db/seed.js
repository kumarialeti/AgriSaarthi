/**
 * AgriSaarthi AI — Database Seed Script
 * Creates realistic demo data clearly labeled as DEMO DATA.
 * Run: npm run seed
 */
import pool, { query, withTransaction } from './pool.js';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

async function seed() {
  logger.info('🌱 Seeding AgriSaarthi database...');

  await withTransaction(async (client) => {
    // ── Crops (Reference Data) ──────────────────────────────────
    logger.info('Seeding crops...');
    const cropData = [
      { name_en: 'Rice', name_te: 'వరి', name_hi: 'चावल', category: 'Cereal', season: 'Kharif', duration: 120 },
      { name_en: 'Cotton', name_te: 'పత్తి', name_hi: 'कपास', category: 'Cash Crop', season: 'Kharif', duration: 180 },
      { name_en: 'Chilli', name_te: 'మిర్చి', name_hi: 'मिर्च', category: 'Spice', season: 'Rabi', duration: 150 },
      { name_en: 'Groundnut', name_te: 'వేరుశనగ', name_hi: 'मूंगफली', category: 'Oilseed', season: 'Kharif', duration: 110 },
      { name_en: 'Maize', name_te: 'మొక్కజొన్న', name_hi: 'मक्का', category: 'Cereal', season: 'Kharif', duration: 100 },
      { name_en: 'Turmeric', name_te: 'పసుపు', name_hi: 'हल्दी', category: 'Spice', season: 'Rabi', duration: 270 },
      { name_en: 'Sugarcane', name_te: 'చెరకు', name_hi: 'गन्ना', category: 'Cash Crop', season: 'Annual', duration: 360 },
      { name_en: 'Tomato', name_te: 'టమాటా', name_hi: 'टमाटर', category: 'Vegetable', season: 'Rabi', duration: 90 },
    ];

    const cropIds = {};
    for (const crop of cropData) {
      const res = await client.query(
        `INSERT INTO crops (name_en, name_te, name_hi, category, season, duration_days)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING RETURNING id`,
        [crop.name_en, crop.name_te, crop.name_hi, crop.category, crop.season, crop.duration]
      );
      if (res.rows[0]) {
        cropIds[crop.name_en] = res.rows[0].id;
      } else {
        const existing = await client.query(`SELECT id FROM crops WHERE name_en = $1`, [crop.name_en]);
        cropIds[crop.name_en] = existing.rows[0].id;
      }
    }

    // ── Markets (Reference Data) ─────────────────────────────────
    logger.info('Seeding markets...');
    const marketData = [
      { name: 'Guntur APMC', district: 'Guntur', state: 'Andhra Pradesh', lat: 16.3067, lng: 80.4365 },
      { name: 'Warangal APMC', district: 'Warangal', state: 'Telangana', lat: 17.9689, lng: 79.5941 },
      { name: 'Nizamabad APMC', district: 'Nizamabad', state: 'Telangana', lat: 18.6725, lng: 78.0941 },
      { name: 'Kurnool APMC', district: 'Kurnool', state: 'Andhra Pradesh', lat: 15.8281, lng: 78.0373 },
      { name: 'Karimnagar APMC', district: 'Karimnagar', state: 'Telangana', lat: 18.4386, lng: 79.1288 },
      { name: 'Ongole APMC', district: 'Prakasam', state: 'Andhra Pradesh', lat: 15.5057, lng: 80.0499 },
    ];

    const marketIds = {};
    for (const market of marketData) {
      const res = await client.query(
        `INSERT INTO markets (name, district, state, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [market.name, market.district, market.state, market.lat, market.lng]
      );
      if (res.rows[0]) {
        marketIds[market.name] = res.rows[0].id;
      } else {
        const existing = await client.query(`SELECT id FROM markets WHERE name = $1`, [market.name]);
        marketIds[market.name] = existing.rows[0].id;
      }
    }

    // ── Market Prices (DEMO DATA) ────────────────────────────────
    logger.info('Seeding market prices (DEMO DATA)...');
    const today = new Date().toISOString().split('T')[0];
    const priceData = [
      { market: 'Guntur APMC', crop: 'Chilli', min: 8500, max: 12000, modal: 10200 },
      { market: 'Guntur APMC', crop: 'Cotton', min: 6200, max: 7100, modal: 6650 },
      { market: 'Guntur APMC', crop: 'Rice', min: 1800, max: 2200, modal: 2000 },
      { market: 'Warangal APMC', crop: 'Cotton', min: 6000, max: 7000, modal: 6500 },
      { market: 'Warangal APMC', crop: 'Rice', min: 1750, max: 2150, modal: 1950 },
      { market: 'Warangal APMC', crop: 'Maize', min: 1400, max: 1800, modal: 1600 },
      { market: 'Nizamabad APMC', crop: 'Rice', min: 1700, max: 2100, modal: 1900 },
      { market: 'Nizamabad APMC', crop: 'Turmeric', min: 7000, max: 9500, modal: 8200 },
      { market: 'Kurnool APMC', crop: 'Groundnut', min: 5200, max: 6400, modal: 5800 },
      { market: 'Kurnool APMC', crop: 'Chilli', min: 8000, max: 11500, modal: 9700 },
      { market: 'Karimnagar APMC', crop: 'Rice', min: 1800, max: 2200, modal: 2050 },
      { market: 'Karimnagar APMC', crop: 'Maize', min: 1350, max: 1750, modal: 1580 },
      { market: 'Ongole APMC', crop: 'Groundnut', min: 5100, max: 6300, modal: 5600 },
      { market: 'Ongole APMC', crop: 'Cotton', min: 6100, max: 7000, modal: 6600 },
    ];

    for (const price of priceData) {
      if (marketIds[price.market] && cropIds[price.crop]) {
        await client.query(
          `INSERT INTO market_prices (market_id, crop_id, min_price_quintal, max_price_quintal, modal_price_quintal, price_date, is_demo, source)
           VALUES ($1, $2, $3, $4, $5, $6, true, 'DEMO DATA - Not real market data')
           ON CONFLICT DO NOTHING`,
          [marketIds[price.market], cropIds[price.crop], price.min, price.max, price.modal, today]
        );
      }
    }

    // ── Government Schemes ───────────────────────────────────────
    logger.info('Seeding government schemes...');
    const schemes = [
      {
        code: 'PM-KISAN',
        name_en: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
        name_te: 'ప్రధాన మంత్రి కిసాన్ సమ్మాన్ నిధి',
        name_hi: 'प्रधानमंत्री किसान सम्मान निधि',
        body: 'Ministry of Agriculture & Farmers Welfare, Government of India',
        benefits_en: 'Direct income support of ₹6,000 per year in three equal installments of ₹2,000 each to all land-holding farmer families.',
        eligibility_en: 'All land-holding farmer families with cultivable land. Excludes: Income Tax payers, constitutional post holders, retired pensioners with monthly pension ≥₹10,000.',
        documents_required: 'Aadhaar card, Bank passbook, Land records (7/12 or equivalent), Mobile number',
        application_url: 'https://pmkisan.gov.in/',
        source_doc: 'PM-KISAN Official Guidelines 2023',
      },
      {
        code: 'PMFBY',
        name_en: 'PMFBY (Pradhan Mantri Fasal Bima Yojana)',
        name_te: 'ప్రధాన మంత్రి ఫసల్ బీమా యోజన',
        name_hi: 'प्रधानमंत्री फसल बीमा योजना',
        body: 'Ministry of Agriculture & Farmers Welfare, Government of India',
        benefits_en: 'Crop insurance covering losses due to natural calamities, pests, and diseases. Premium: 1.5–2% for Rabi, 2% for Kharif food/oilseeds, 5% for commercial/horticulture crops.',
        eligibility_en: 'All farmers growing notified crops. Both loanee (mandatory) and non-loanee farmers can enroll.',
        documents_required: 'Aadhaar card, Bank account, Land records, Sowing certificate',
        application_url: 'https://pmfby.gov.in/',
        source_doc: 'PMFBY Guidelines 2023-24',
      },
      {
        code: 'KCC',
        name_en: 'Kisan Credit Card (KCC)',
        name_te: 'కిసాన్ క్రెడిట్ కార్డ్',
        name_hi: 'किसान क्रेडिट कार्ड',
        body: 'NABARD / All Scheduled Banks',
        benefits_en: 'Revolving credit facility for farm inputs, crop production, post-harvest expenses, and allied activities. Interest subvention: loans up to ₹3 lakh at 7% (effectively 4% with 3% prompt repayment incentive).',
        eligibility_en: 'All farmers, sharecroppers, tenant farmers, and SHG/JLG members engaged in agriculture.',
        documents_required: 'Aadhaar, PAN card, Land documents, Passport photo, Bank account',
        application_url: 'https://www.nabard.org/kcc',
        source_doc: 'KCC Revised Scheme Guidelines 2020',
      },
      {
        code: 'RKVY',
        name_en: 'Rashtriya Krishi Vikas Yojana (RKVY)',
        name_te: 'రాష్ట్రీయ కృషి వికాస్ యోజన',
        name_hi: 'राष्ट्रीय कृषि विकास योजना',
        body: 'Ministry of Agriculture & Farmers Welfare',
        benefits_en: 'Funding for agricultural infrastructure, value chain development, agri-entrepreneurship, and innovation. Covers horticulture, animal husbandry, fisheries, and crop farming.',
        eligibility_en: 'Farmers, farmer groups, FPOs, SHGs, agri-startups via state agriculture departments.',
        documents_required: 'Project proposal, land records, group registration, bank account',
        application_url: 'https://rkvy.nic.in/',
        source_doc: 'RKVY-RAFTAAR Guidelines 2022-23',
      },
      {
        code: 'APSDPS',
        name_en: 'Andhra Pradesh Rythu Bandhu Scheme',
        name_te: 'రైతు బంధు పథకం',
        name_hi: 'आंध्र प्रदेश रायतू बंधु योजना',
        body: 'Government of Andhra Pradesh',
        benefits_en: 'Investment support of ₹10,000 per acre per season (₹5,000 Kharif + ₹5,000 Rabi) directly to farmer\'s bank account for purchasing farm inputs.',
        eligibility_en: 'All land-owning farmers in Andhra Pradesh. Both agricultural and horticultural land owners are eligible.',
        documents_required: 'Aadhaar, Pattadar passbook, Bank account linked to Aadhaar',
        application_url: 'https://apagrisnet.gov.in/',
        source_doc: 'AP Rythu Bandhu Scheme Guidelines 2023',
      },
    ];

    for (const scheme of schemes) {
      await client.query(
        `INSERT INTO government_schemes 
         (scheme_code, name_en, name_te, name_hi, implementing_body, benefits_en, eligibility_en, documents_required, application_url, source_doc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (scheme_code) DO NOTHING`,
        [scheme.code, scheme.name_en, scheme.name_te, scheme.name_hi, scheme.body,
         scheme.benefits_en, scheme.eligibility_en, scheme.documents_required,
         scheme.application_url, scheme.source_doc]
      );
    }

    // ── Demo Users ───────────────────────────────────────────────
    logger.info('Seeding demo users...');
    const hash = await bcrypt.hash('Demo@12345', 10);

    const demoUsers = [
      { email: 'farmer@demo.agrisaarthi.in', role: 'FARMER', lang: 'te' },
      { email: 'buyer@demo.agrisaarthi.in', role: 'BUYER', lang: 'en' },
      { email: 'officer@demo.agrisaarthi.in', role: 'AGRICULTURE_OFFICER', lang: 'en' },
      { email: 'admin@demo.agrisaarthi.in', role: 'ADMIN', lang: 'en' },
    ];

    const userIds = {};
    for (const u of demoUsers) {
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role, language, email_verified)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, updated_at = NOW()
         RETURNING id`,
        [u.email, hash, u.role, u.lang]
      );
      userIds[u.role] = res.rows[0].id;
    }

    // ── Demo Farmer Profile ──────────────────────────────────────
    logger.info('Seeding demo farmer profile...');
    const farmerRes = await client.query(
      `INSERT INTO farmer_profiles 
       (user_id, full_name, phone, village, mandal, district, state, pincode, total_land_acres)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO NOTHING RETURNING id`,
      [userIds['FARMER'], 'రాజు పటేల్ (Raju Patel)', '9876543210', 'Kommuru', 'Pedanandipadu', 'Guntur', 'Andhra Pradesh', '522235', 5.5]
    );

    if (farmerRes.rows[0]) {
      const farmerId = farmerRes.rows[0].id;

      // Demo crops for farmer
      await client.query(
        `INSERT INTO farmer_crops (farmer_id, crop_id, acreage, sowing_date, irrigation_type, soil_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [farmerId, cropIds['Chilli'], 3.0, '2025-10-15', 'Drip', 'Red Sandy Loam', 'GROWING']
      );
      await client.query(
        `INSERT INTO farmer_crops (farmer_id, crop_id, acreage, sowing_date, irrigation_type, soil_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [farmerId, cropIds['Groundnut'], 2.5, '2025-07-01', 'Sprinkler', 'Black Cotton Soil', 'HARVESTED']
      );

      // Demo soil report
      await client.query(
        `INSERT INTO soil_reports 
         (farmer_id, ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_pct, ec_ds_m, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [farmerId, 6.8, 240.5, 18.2, 180.0, 0.68, 0.42, 'manual']
      );
    }

    // ── Demo Buyer Profile ───────────────────────────────────────
    logger.info('Seeding demo buyer profile...');
    const buyerProfileRes = await client.query(
      `INSERT INTO buyer_profiles 
       (user_id, full_name, company_name, phone, city, state, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO NOTHING RETURNING id`,
      [userIds['BUYER'], 'Suresh Kumar', 'Andhra Agro Traders Pvt Ltd', '9988776655', 'Vijayawada', 'Andhra Pradesh', true]
    );

    if (buyerProfileRes.rows[0]) {
      // Demo buyer requirement
      await client.query(
        `INSERT INTO buyer_requirements 
         (buyer_id, crop_id, quantity_kg, desired_price_quintal, delivery_location, delivery_state, required_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [buyerProfileRes.rows[0].id, cropIds['Chilli'], 5000, 9500, 'Vijayawada', 'Andhra Pradesh', '2026-03-31']
      );
    }
  });

  logger.info('✅ Database seeding complete!');
  logger.info('Demo credentials:');
  logger.info('  Farmer:  farmer@demo.agrisaarthi.in / Demo@12345');
  logger.info('  Buyer:   buyer@demo.agrisaarthi.in / Demo@12345');
  logger.info('  Officer: officer@demo.agrisaarthi.in / Demo@12345');
  logger.info('  Admin:   admin@demo.agrisaarthi.in / Demo@12345');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
