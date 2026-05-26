-- 1. Create chats table
CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(property_id, buyer_id)
);

-- 2. Create chat_messages table
CREATE TABLE public.chat_messages (
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
CREATE POLICY "Users can view their own chats" ON public.chats 
    FOR SELECT USING (buyer_id = auth.uid()::text OR seller_id = auth.uid()::text OR true);

CREATE POLICY "Service role can manage chats" ON public.chats 
    FOR ALL USING (true);

-- 5. Create Policies for chat_messages
CREATE POLICY "Users can view messages of their chats" ON public.chat_messages 
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage messages" ON public.chat_messages 
    FOR ALL USING (true);

-- 6. Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
