-- ================================================================
-- AgriSaarthi AI — PostgreSQL Schema
-- ================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search

-- ----------------------------------------------------------------
-- ENUM Types
-- ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('FARMER', 'BUYER', 'AGRICULTURE_OFFICER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crop_status AS ENUM ('PLANNED', 'GROWING', 'HARVESTED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('MATCH', 'ALERT', 'SCHEME', 'WEATHER', 'MARKET', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE language_code AS ENUM ('en', 'te', 'hi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'FARMER',
  language      language_code NOT NULL DEFAULT 'en',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------
-- FARMER PROFILES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmer_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(20),
  village         VARCHAR(255),
  mandal          VARCHAR(255),
  district        VARCHAR(255),
  state           VARCHAR(255),
  pincode         VARCHAR(10),
  total_land_acres DECIMAL(10, 2),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_farmer_profiles_user_id ON farmer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_farmer_profiles_district ON farmer_profiles(district);

-- ----------------------------------------------------------------
-- BUYER PROFILES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyer_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  company_name    VARCHAR(255),
  phone           VARCHAR(20),
  gst_number      VARCHAR(20),
  address         TEXT,
  city            VARCHAR(255),
  state           VARCHAR(255),
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  rating          DECIMAL(3,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- CROPS (Reference Data)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en     VARCHAR(255) NOT NULL,
  name_te     VARCHAR(255),
  name_hi     VARCHAR(255),
  category    VARCHAR(100),
  season      VARCHAR(100),
  duration_days INTEGER,
  icon_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crops_name ON crops(name_en);

-- ----------------------------------------------------------------
-- FARMER CROPS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmer_crops (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id       UUID NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
  crop_id         UUID NOT NULL REFERENCES crops(id),
  acreage         DECIMAL(10, 2) NOT NULL,
  sowing_date     DATE,
  expected_harvest_date DATE,
  irrigation_type VARCHAR(100),
  soil_type       VARCHAR(100),
  status          crop_status NOT NULL DEFAULT 'PLANNED',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_farmer_crops_farmer ON farmer_crops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_crops_crop ON farmer_crops(crop_id);
CREATE INDEX IF NOT EXISTS idx_farmer_crops_status ON farmer_crops(status);

-- ----------------------------------------------------------------
-- SOIL REPORTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soil_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id       UUID NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
  farmer_crop_id  UUID REFERENCES farmer_crops(id),
  ph              DECIMAL(4, 2),
  nitrogen_kg_ha  DECIMAL(8, 2),
  phosphorus_kg_ha DECIMAL(8, 2),
  potassium_kg_ha DECIMAL(8, 2),
  organic_carbon_pct DECIMAL(5, 3),
  ec_ds_m         DECIMAL(6, 3),
  upload_url      TEXT,
  extracted_text  TEXT,
  source          VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual' | 'upload'
  ai_analysis     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soil_reports_farmer ON soil_reports(farmer_id);

-- ----------------------------------------------------------------
-- CROP HEALTH REPORTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crop_health_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_crop_id  UUID NOT NULL REFERENCES farmer_crops(id) ON DELETE CASCADE,
  image_url       TEXT NOT NULL,
  analysis_result JSONB,
  detected_issue  VARCHAR(255),
  confidence      DECIMAL(5,4),
  severity        VARCHAR(50),
  ai_response     TEXT,
  sources         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_reports_crop ON crop_health_reports(farmer_crop_id);

-- ----------------------------------------------------------------
-- MARKETS (Reference Data)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS markets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  market_type VARCHAR(100) DEFAULT 'APMC',
  district    VARCHAR(255),
  state       VARCHAR(255),
  latitude    DECIMAL(10, 7),
  longitude   DECIMAL(10, 7),
  contact     VARCHAR(100),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_markets_district ON markets(district);

-- ----------------------------------------------------------------
-- MARKET PRICES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_prices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id         UUID NOT NULL REFERENCES markets(id),
  crop_id           UUID NOT NULL REFERENCES crops(id),
  min_price_quintal DECIMAL(10, 2),
  max_price_quintal DECIMAL(10, 2),
  modal_price_quintal DECIMAL(10, 2) NOT NULL,
  price_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  is_demo           BOOLEAN NOT NULL DEFAULT true,
  source            VARCHAR(255),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_prices_crop_date ON market_prices(crop_id, price_date DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_market ON market_prices(market_id);

-- ----------------------------------------------------------------
-- BUYER REQUIREMENTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyer_requirements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id        UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  crop_id         UUID NOT NULL REFERENCES crops(id),
  quantity_kg     DECIMAL(12, 2) NOT NULL,
  desired_price_quintal DECIMAL(10, 2),
  delivery_location VARCHAR(255),
  delivery_state  VARCHAR(255),
  required_by     DATE,
  quality_specs   TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buyer_req_buyer ON buyer_requirements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_req_crop ON buyer_requirements(crop_id);
CREATE INDEX IF NOT EXISTS idx_buyer_req_status ON buyer_requirements(status);

-- ----------------------------------------------------------------
-- FARMER BUYER MATCHES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmer_buyer_matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_crop_id  UUID NOT NULL REFERENCES farmer_crops(id),
  buyer_req_id    UUID NOT NULL REFERENCES buyer_requirements(id),
  match_score     DECIMAL(5, 4) NOT NULL,
  explanation     TEXT,
  factors         JSONB,
  status          match_status NOT NULL DEFAULT 'PENDING',
  initiated_by    VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(farmer_crop_id, buyer_req_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_farmer_crop ON farmer_buyer_matches(farmer_crop_id);
CREATE INDEX IF NOT EXISTS idx_matches_buyer_req ON farmer_buyer_matches(buyer_req_id);

-- ----------------------------------------------------------------
-- COOPERATIVE GROUPS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cooperative_groups (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_req_id      UUID NOT NULL REFERENCES buyer_requirements(id),
  combined_quantity_kg DECIMAL(12, 2),
  status            VARCHAR(50) NOT NULL DEFAULT 'FORMING',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cooperative_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID NOT NULL REFERENCES cooperative_groups(id),
  farmer_crop_id  UUID NOT NULL REFERENCES farmer_crops(id),
  quantity_kg     DECIMAL(12, 2) NOT NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, farmer_crop_id)
);

-- ----------------------------------------------------------------
-- GOVERNMENT SCHEMES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS government_schemes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_code     VARCHAR(50) UNIQUE,
  name_en         VARCHAR(500) NOT NULL,
  name_te         VARCHAR(500),
  name_hi         VARCHAR(500),
  implementing_body VARCHAR(255),
  benefits_en     TEXT,
  benefits_te     TEXT,
  benefits_hi     TEXT,
  eligibility_en  TEXT,
  documents_required TEXT,
  application_url TEXT,
  source_doc      VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- RECOMMENDATIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id       UUID NOT NULL REFERENCES farmer_profiles(id),
  type            VARCHAR(100) NOT NULL, -- soil|crop|market|scheme|health|general
  title           TEXT,
  content         TEXT NOT NULL,
  confidence      DECIMAL(5, 4),
  factors         JSONB,
  sources         JSONB,
  language        language_code NOT NULL DEFAULT 'en',
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recommendations_farmer ON recommendations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);

-- ----------------------------------------------------------------
-- CHAT SESSIONS & MESSAGES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  language    language_code NOT NULL DEFAULT 'en',
  title       VARCHAR(500),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT NOT NULL,
  image_url     TEXT,
  agent_trace   JSONB,
  sources       JSONB,
  audio_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- ----------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL DEFAULT 'SYSTEM',
  title       VARCHAR(500) NOT NULL,
  body        TEXT,
  data        JSONB,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ----------------------------------------------------------------
-- AGENT LOGS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_session_id UUID REFERENCES chat_sessions(id),
  user_id         UUID REFERENCES users(id),
  agent_name      VARCHAR(100),
  intent          VARCHAR(100),
  input_summary   TEXT,
  output_summary  TEXT,
  agents_used     TEXT[],
  duration_ms     INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_session ON agent_logs(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);

-- ----------------------------------------------------------------
-- Triggers: updated_at auto-update
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_farmer_profiles_updated_at BEFORE UPDATE ON farmer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_farmer_crops_updated_at BEFORE UPDATE ON farmer_crops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_soil_reports_updated_at BEFORE UPDATE ON soil_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_buyer_requirements_updated_at BEFORE UPDATE ON buyer_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON farmer_buyer_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
