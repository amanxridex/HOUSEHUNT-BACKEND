-- GOD MODE SCHEMA: HOUSEHUNT MASTER
-- Run this in Supabase SQL Editor to initialize the entire platform.

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE PROFILES TABLE (User Data)
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    
    -- DYNAMIC DETAILS (JSONB for Apartment/Villa/Commercial specific metadata)
    -- Stores everything: Power Load, Servant Room, Private Pool, Tenant Prefs, etc.
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

-- 5. ACCESS POLICIES
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Approved properties are public" ON public.properties FOR SELECT USING (status = 'approved');
CREATE POLICY "Owners can view their own properties" ON public.properties FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert their own properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their own properties" ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their own properties" ON public.properties FOR DELETE USING (auth.uid() = owner_id);

-- 6. AUTOMATION: SYNC AUTH USERS TO PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. CREATE FAVORITES TABLE
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, property_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT USING (user_id = auth.uid()::text OR true); -- Simplified for backend sync
CREATE POLICY "Service Role bypass favorites" ON public.favorites FOR ALL USING (true);

-- 8. PERFORMANCE INDEXES
CREATE INDEX idx_properties_type ON public.properties(property_type);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_city ON public.properties(city);
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
