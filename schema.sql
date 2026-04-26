-- Create Properties Table
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    price BIGINT,
    location TEXT,
    type TEXT, -- 'Apartment', 'Villa', 'Plot', etc.
    intent TEXT, -- 'Buy', 'Rent'
    images TEXT[], -- Array of image URLs
    owner_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Users Profile Table (Extending Auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'buyer', -- 'buyer', 'seller', 'admin'
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for Properties
CREATE POLICY "Public properties are viewable by everyone." ON properties
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can insert their own properties." ON properties
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone." ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile." ON user_profiles
    FOR UPDATE USING (auth.uid() = id);
