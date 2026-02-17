-- =============================================
-- RYANEKO LICENSE MANAGEMENT SYSTEM
-- Database Schema for Supabase
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: products
-- =============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  detection_keywords TEXT[] DEFAULT '{}',
  download_urls JSONB DEFAULT '{}',
  plugin_url TEXT,
  has_plugin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default products
INSERT INTO products (name, slug, detection_keywords, download_urls, has_plugin, plugin_url) VALUES
(
  'RAW File Copy Tool',
  'raw-file-copy-tool',
  ARRAY['raw file copy', 'rawfilecopytool'],
  '{
    "main": "https://drive.google.com/drive/folders/10ujMTzZPuR31TSsu59uHl3NJ093Hn0Ix?usp=sharing"
  }',
  false,
  NULL
),
(
  'Realtime Upload Pro',
  'realtime-upload-pro',
  ARRAY['realtime upload', 'ru pro'],
  '{
    "main": "https://drive.google.com/drive/folders/1JsEirrSjVjcVZG-X_MX9LsQP9b9i87lN?usp=sharing"
  }',
  true,
  'https://drive.google.com/drive/folders/1MdXSsgY1jOOAu1vG4RUA-keigO2Y6Oyi?usp=sharing'
),
(
  'Photo Split Express',
  'photo-split-express',
  ARRAY['photo split'],
  '{
    "main": "https://drive.google.com/drive/folders/16AjYHWxAeECvEIXUnsPfmVk_8aaz6iG-?usp=sharing"
  }',
  false,
  NULL
),
(
  'Fastpik',
  'fastpik',
  ARRAY['fastpik', 'fast pik', 'fast-pik'],
  '{}',
  false,
  NULL
);

-- =============================================
-- TABLE: licenses
-- =============================================
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  serial_key TEXT UNIQUE NOT NULL,
  serial_hash TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'revoked')),
  
  -- Customer Info (filled on purchase)
  customer_name TEXT,
  customer_email TEXT,
  order_id TEXT,
  
  -- Activation Info (filled on app activation)
  device_type TEXT,
  device_id TEXT,
  device_hash TEXT,
  activated_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  
  batch_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX idx_licenses_product_id ON licenses(product_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_serial_hash ON licenses(serial_hash);
CREATE INDEX idx_licenses_customer_email ON licenses(customer_email);

-- =============================================
-- TABLE: purchases
-- =============================================
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  license_count INT DEFAULT 1,
  includes_plugin BOOLEAN DEFAULT false,
  addons JSONB,
  raw_payload JSONB,
  licenses_assigned UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_purchases_product_id ON purchases(product_id);
CREATE INDEX idx_purchases_customer_email ON purchases(customer_email);

-- =============================================
-- TABLE: activations (Audit Log)
-- =============================================
CREATE TABLE activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('activate', 'verify', 'transfer', 'revoke')),
  device_id TEXT,
  device_type TEXT,
  os_version TEXT,
  ip_address TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_activations_license_id ON activations(license_id);
CREATE INDEX idx_activations_created_at ON activations(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- For now, disable RLS - we'll use service role key for all operations
-- In production, you might want to enable RLS with specific policies

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role full access" ON products FOR ALL USING (true);
CREATE POLICY "Service role full access" ON licenses FOR ALL USING (true);
CREATE POLICY "Service role full access" ON purchases FOR ALL USING (true);
CREATE POLICY "Service role full access" ON activations FOR ALL USING (true);
