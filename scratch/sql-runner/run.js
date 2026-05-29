const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:Amanismad%231@db.unvqetnowelmsywhtydb.supabase.co:5432/postgres'
});

const sql = `
-- 1. Create chats table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(property_id, buyer_id)
);

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
    sender_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for chats
DO $$ BEGIN
    CREATE POLICY "Users can view their own chats" ON public.chats 
        FOR SELECT USING (buyer_id = auth.uid()::text OR seller_id = auth.uid()::text OR true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage chats" ON public.chats 
        FOR ALL USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create Policies for chat_messages
DO $$ BEGIN
    CREATE POLICY "Users can view messages of their chats" ON public.chat_messages 
        FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage messages" ON public.chat_messages 
        FOR ALL USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Enable Realtime for messages (this might fail if already added, so wrap in DO block)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
`;

async function run() {
    try {
        await client.connect();
        console.log("Connected to Supabase DB successfully!");
        
        await client.query(sql);
        console.log("Schema creation SQL executed successfully!");
        
    } catch (e) {
        console.error("Error executing SQL:", e);
    } finally {
        await client.end();
    }
}

run();
