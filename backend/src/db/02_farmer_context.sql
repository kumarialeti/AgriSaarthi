-- ================================================================
-- AgriSaarthi AI — Phase 2: Farmer Context Migration
-- ================================================================

-- 1. Alter farmer_profiles
ALTER TABLE farmer_profiles
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS farming_experience_years INTEGER,
ADD COLUMN IF NOT EXISTS farming_preference VARCHAR(50); -- 'ORGANIC' | 'CONVENTIONAL' | 'MIXED'

-- 2. Create fields table
CREATE TABLE IF NOT EXISTS fields (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id       UUID NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  area            DECIMAL(10, 2) NOT NULL,
  area_unit       VARCHAR(50) NOT NULL DEFAULT 'Acres',
  location_lat    DECIMAL(10, 7),
  location_lng    DECIMAL(10, 7),
  soil_type       VARCHAR(100),
  soil_ph         DECIMAL(4, 2),
  irrigation_source VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fields_farmer ON fields(farmer_id);

DO $$ BEGIN
  CREATE TRIGGER update_fields_updated_at 
  BEFORE UPDATE ON fields 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Alter farmer_crops
ALTER TABLE farmer_crops
ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS variety VARCHAR(255),
ADD COLUMN IF NOT EXISTS growth_stage VARCHAR(100),
ADD COLUMN IF NOT EXISTS previous_crop VARCHAR(255);

-- 4. Alter crop_health_reports (allow general crop scans without pre-selected crop)
ALTER TABLE crop_health_reports ALTER COLUMN farmer_crop_id DROP NOT NULL;
