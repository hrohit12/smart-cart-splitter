-- ==========================================================
-- SMART CART SPLITTER - SUPABASE DATABASE SCHEMA
-- ==========================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-running
DROP TABLE IF EXISTS payment_splits CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- 1. ORDERS TABLE
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(64) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    payment_limit NUMERIC(12, 2) NOT NULL DEFAULT 2000.00,
    number_of_splits INTEGER NOT NULL CHECK (number_of_splits >= 1),
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'FULLY_PAID', 'FAILED')),
    estimated_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estimated_savings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PAYMENT SPLITS TABLE
CREATE TABLE payment_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'READY', 'PAID', 'FAILED')),
    razorpay_payment_link_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    payment_url TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_order_sequence UNIQUE (order_id, sequence_number)
);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_splits_order_id ON payment_splits(order_id);
CREATE INDEX idx_splits_status ON payment_splits(status);
CREATE INDEX idx_splits_link_id ON payment_splits(razorpay_payment_link_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;

-- Allow public read access to orders and splits for checkout confirmation
CREATE POLICY "Allow public read access on orders" 
ON orders FOR SELECT 
USING (true);

CREATE POLICY "Allow public read access on payment_splits" 
ON payment_splits FOR SELECT 
USING (true);

-- Allow service role full write access (Express backend uses Service Role Key)
CREATE POLICY "Allow service role full access on orders" 
ON orders FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on payment_splits" 
ON payment_splits FOR ALL 
USING (auth.role() = 'service_role');

-- If using anon key during prototyping/development:
CREATE POLICY "Allow anon insert/update on orders" 
ON orders FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow anon insert/update on payment_splits" 
ON payment_splits FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. SAMPLE SEED DATA FOR DEMO DASHBOARD
INSERT INTO orders (
    order_number, 
    customer_name, 
    customer_email, 
    total_amount, 
    payment_limit, 
    number_of_splits, 
    total_paid, 
    status, 
    estimated_fee, 
    estimated_savings
) VALUES 
('ORD-91042', 'Aarav Mehta', 'aarav@example.com', 4680.00, 2000.00, 3, 4680.00, 'FULLY_PAID', 18.72, 18.72),
('ORD-88219', 'Priya Sharma', 'priya@example.com', 3800.00, 2000.00, 2, 3800.00, 'FULLY_PAID', 15.20, 15.20),
('ORD-74120', 'Rohan Gupta', 'rohan@example.com', 5600.00, 2000.00, 3, 3733.34, 'PARTIALLY_PAID', 22.40, 22.40),
('ORD-63914', 'Ananya Patel', 'ananya@example.com', 1950.00, 2000.00, 1, 1950.00, 'FULLY_PAID', 7.80, 0.00);
