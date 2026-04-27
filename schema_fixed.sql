-- FIX FOR FIREBASE AUTH USERS
-- Run this in Supabase SQL Editor to allow Firebase UIDs as IDs.

-- 1. Drop existing tables to reset schema (WARNING: This deletes existing data)
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. CREATE PROFILES TABLE (Compatible with Firebase UIDs)
CREATE TABLE public.profiles (
    id TEXT PRIMARY KEY, -- Changed from UUID to TEXT for Firebase
    full_name TEXT,
    email TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CREATE PROPERTIES TABLE (Master Database)
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Changed to TEXT
    
    -- CORE INFO
    title TEXT NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) >= 50),
    property_type TEXT NOT NULL CHECK (property_type IN ('Apartment', 'Independent House', 'Villa', 'Commercial', 'Plot')),
    intent TEXT NOT NULL CHECK (intent IN ('Rent', 'Buy')),
    
    -- PRICING & CHARGES
    price DECIMAL(15,2) NOT NULL,
    deposit DECIMAL(15,2),
    maintenance DECIMAL(10,2) DEFAULT 0,
    brokerage TEXT DEFAULT 'None',
    is_negotiable BOOLEAN DEFAULT FALSE,
    
    -- LOCATION & VISIBILITY
    location_text TEXT NOT NULL,
    city TEXT NOT NULL,
    hide_exact_location BOOLEAN DEFAULT FALSE,
    
    -- MEDIA
    images TEXT[] DEFAULT '{}',
    
    -- DYNAMIC DETAILS (JSONB)
    details JSONB DEFAULT '{}'::jsonb,
    
    -- CONTACT & SOCIAL
    show_phone_publicly BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT TRUE,
    
    -- MODERATION SYSTEM
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- 5. ACCESS POLICIES (Simplified for Firebase Integration)
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
-- Note: Since we use Service Role on backend, we don't strictly need RLS policies for inserts/updates from the Node server.
-- But for safety:
CREATE POLICY "Service Role bypass" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Service Role bypass props" ON public.properties FOR ALL USING (true);

-- 6. PERFORMANCE INDEXES
CREATE INDEX idx_properties_type ON public.properties(property_type);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_city ON public.properties(city);
