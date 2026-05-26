const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 5000;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Trust proxy to get correct IPs if hosted on Render/Heroku
app.set('trust proxy', 1);

// Supabase Client Initialization
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Using Service Role for Admin/Backend operations
);

// Redis Client Initialization
const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test Redis connection
(async () => {
    try {
        await redis.set("foo", "bar");
        const val = await redis.get("foo");
        console.log("Redis connection successful. Test key 'foo' =", val);
    } catch (err) {
        console.error("Redis connection failed:", err);
    }
})();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- GLOBAL REQUEST LOGGER ---
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            timestamp: new Date().toISOString(),
            method: req.method,
            endpoint: req.originalUrl,
            status: res.statusCode,
            ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            user_agent: req.headers['user-agent'] || 'Unknown',
            duration: duration
        };

        // Push to Redis list 'admin_logs'
        try {
            await redis.lpush('admin_logs', JSON.stringify(logEntry));
            // Keep only the latest 1000 logs
            await redis.ltrim('admin_logs', 0, 999);
        } catch (e) {
            console.error('Failed to log to Redis', e);
        }
    });
    next();
});

// --- PUBLIC ROUTES (USER FRONTEND) ---

// Get all approved properties
app.get('/api/properties', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('status', 'approved'); // Only show approved properties to users
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get profile by ID
app.get('/api/profiles/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Post a new property or finalize a draft (Submitted by user, pending approval)
app.post('/api/properties', async (req, res) => {
    try {
        console.log("Incoming Property Data:", req.body);
        const { id, ...propertyData } = req.body;
        
        if (id) {
            const { data, error } = await supabase
                .from('properties')
                .update({ ...propertyData, status: 'pending', updated_at: new Date() })
                .eq('id', id)
                .select();
            if (error) throw error;
            res.status(200).json(data[0]);
        } else {
            const { data, error } = await supabase
                .from('properties')
                .insert([{ ...propertyData, status: 'pending' }])
                .select();
            if (error) throw error;
            res.status(201).json(data[0]);
        }
    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Create or Update a Draft
app.post('/api/properties/draft', async (req, res) => {
    try {
        const { id, ...draftData } = req.body;
        
        if (id) {
            // Update existing draft
            const { data, error } = await supabase
                .from('properties')
                .update({ ...draftData, status: 'draft', updated_at: new Date() })
                .eq('id', id)
                .select();
            if (error) throw error;
            res.json(data[0]);
        } else {
            // Create new draft
            const { data, error } = await supabase
                .from('properties')
                .insert([{ ...draftData, status: 'draft' }])
                .select();
            if (error) throw error;
            res.status(201).json(data[0]);
        }
    } catch (error) {
        console.error("Draft Save Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Delete a Draft
app.delete('/api/properties/draft/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('properties')
            .delete()
            .eq('id', id)
            .eq('status', 'draft');
            
        if (error) throw error;
        res.status(200).json({ message: 'Draft deleted successfully' });
    } catch (error) {
        console.error("Draft Delete Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- SUPPORT TICKETS ROUTE ---
app.post('/api/tickets', async (req, res) => {
    try {
        const { ticket_id, user_id, issue_text } = req.body;
        const { data, error } = await supabase
            .from('support_tickets')
            .insert([{ ticket_id, user_id, issue_text }])
            .select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        console.error("Ticket Creation Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- GET TICKET MESSAGES ---
app.get('/api/tickets/:id/messages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', req.params.id)
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- POST TICKET MESSAGE ---
app.post('/api/tickets/:id/messages', async (req, res) => {
    try {
        const { sender_role, message } = req.body;
        const { data, error } = await supabase
            .from('ticket_messages')
            .insert([{ ticket_id: req.params.id, sender_role, message }])
            .select();
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GET TICKET STATUS ---
app.get('/api/tickets/status/:ticket_id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('status, rating')
            .eq('ticket_id', req.params.ticket_id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SUBMIT TICKET RATING ---
app.patch('/api/tickets/:id/rating', async (req, res) => {
    try {
        const { rating } = req.body;
        const { data, error } = await supabase
            .from('support_tickets')
            .update({ rating })
            .eq('id', req.params.id)
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ADMIN ROUTES (ADMIN PANEL) ---

// 1. Admin Rate Limiter
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
    handler: async (req, res, next, options) => {
        // Log rate limit abuse
        await supabase.from('security_logs').insert([{
            ip_address: req.ip,
            user_agent: req.get('User-Agent') || 'Unknown',
            endpoint: req.originalUrl,
            method: req.method
        }]);
        res.status(options.statusCode).send(options.message);
    }
});

// 2. Admin Auth & Security Logger Middleware
const adminAuthMiddleware = async (req, res, next) => {
    // For now, we expect a simple secret header to prove the request is from our actual admin frontend.
    // In production, this should be a verified JWT.
    const adminToken = req.headers['x-admin-token'];
    
    // Simulate a simple shared secret check (e.g., 'Aarambhindia-Secret')
    if (adminToken !== 'Aarambhindia-Secret') {
        // Log the unauthorized attempt
        try {
            await supabase.from('security_logs').insert([{
                ip_address: req.ip,
                user_agent: req.get('User-Agent') || 'Unknown',
                endpoint: req.originalUrl,
                method: req.method
            }]);
        } catch (e) { console.error('Security log failed', e); }
        
        return res.status(403).json({ error: 'Forbidden: Unauthorized Admin Access' });
    }
    next();
};

// Apply security to all /api/admin routes
app.use('/api/admin', adminLimiter);
app.use('/api/admin', adminAuthMiddleware);

// Get all properties (including pending)
app.get('/api/admin/properties', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all users (profiles)
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all support tickets
app.get('/api/admin/tickets', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .select(`
                *,
                profiles (
                    email,
                    full_name
                )
            `)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update support ticket status
app.patch('/api/admin/tickets/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('support_tickets')
            .update({ status })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve/Reject Property
app.patch('/api/admin/properties/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    
    try {
        const { data, error } = await supabase
            .from('properties')
            .update({ status })
            .eq('id', id);
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User Analytics
app.get('/api/admin/analytics', async (req, res) => {
    try {
        // Fetch properties (Total & Pending)
        const { data: properties, error: propErr } = await supabase.from('properties').select('status');
        if (propErr) throw propErr;
        const totalProperties = properties.length;
        const pendingApprovals = properties.filter(p => p.status === 'pending').length;

        // Fetch Total Users
        const { data: users, error: userErr } = await supabase.from('profiles').select('id');
        if (userErr) throw userErr;
        const totalUsers = users.length;

        res.json({
            totalProperties,
            pendingApprovals,
            totalUsers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User Stats
app.get('/api/admin/user-stats', async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0,0,0,0);
        
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        // Fetch Users
        const { data: users, error: userErr } = await supabase.from('profiles').select('id, created_at');
        if (userErr) throw userErr;
        
        const totalUsers = users.length;
        const newToday = users.filter(u => new Date(u.created_at) >= today).length;
        const new7Days = users.filter(u => new Date(u.created_at) >= sevenDaysAgo).length;
        const new30Days = users.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length;

        // Fetch Unique Visitors Today
        const { data: views, error: viewErr } = await supabase
            .from('page_views')
            .select('ip_address')
            .gte('created_at', today.toISOString());
            
        if (viewErr) throw viewErr;
        
        const visitorsToday = new Set(views.map(v => v.ip_address)).size;

        res.json({
            totalUsers,
            newToday,
            new7Days,
            new30Days,
            visitorsToday
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get security defense logs
app.get('/api/admin/defense-logs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('security_logs')
            .select('*')
            .order('timestamp', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DEVELOPERS ROUTES ---

// Get all developers (Public)
app.get('/api/developers', async (req, res) => {
    try {
        const { data, error } = await supabase.from('developers').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add developer (Admin)
app.post('/api/admin/developers', async (req, res) => {
    try {
        const { name, short_code, link, logo_url } = req.body;
        const { data, error } = await supabase.from('developers').insert([{ name, short_code, link, logo_url }]).select();
        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Edit developer (Admin)
app.put('/api/admin/developers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, short_code, link, logo_url } = req.body;
        const { data, error } = await supabase.from('developers')
            .update({ name, short_code, link, logo_url })
            .eq('id', id)
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete developer (Admin)
app.delete('/api/admin/developers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('developers').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- USER PROFILE ROUTES ---

// Track Page Views
app.post('/api/track-view', async (req, res) => {
    try {
        let ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
        if (ip.includes(',')) ip = ip.split(',')[0].trim(); // Handle multiple proxies
        
        const { page_url } = req.body || {};
        await supabase.from('page_views').insert([{ ip_address: ip, page_url }]);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User Properties
app.get('/api/user/properties/:uid', async (req, res) => {
    try {
        const { uid } = req.params;
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('owner_id', uid)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User Profile (Checks for Phone)
app.get('/api/user/profile/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update User Profile (e.g., Add Phone)
app.patch('/api/user/profile/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { phone, name, email, photo } = req.body;
        
        const { data, error } = await supabase
            .from('profiles')
            .upsert({ 
                id, 
                phone, 
                full_name: name, 
                email: email,
                avatar_url: photo,
                updated_at: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- IMAGE UPLOAD ROUTE ---
app.post('/api/upload', upload.array('images', 6), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadPromises = files.map(async (file) => {
            const fileName = `${Date.now()}-${file.originalname}`;
            const { data, error } = await supabase.storage
                .from('property-images')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('property-images')
                .getPublicUrl(fileName);

            return publicUrlData.publicUrl;
        });

        const urls = await Promise.all(uploadPromises);
        res.json({ urls });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- AI PROXY ROUTES ---
const axios = require('axios');

app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        const response = await axios.post(GEMINI_URL, {
            contents: [{
                parts: [{
                    text: `You are HuntAI, a premium real estate assistant for HouseHunt India. 
                    Your goal is to help users find properties (Apartments, Villas, Plots) in India (especially Noida, Delhi, Gurgaon).
                    Be professional, helpful, and concise. 
                    The user says: ${message}`
                }]
            }]
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        res.json(response.data);
    } catch (error) {
        const errorData = error.response ? error.response.data : error.message;
        console.error("AI Proxy Full Error:", JSON.stringify(errorData, null, 2));
        res.status(500).json({ 
            error: "Failed to connect to AI Service", 
            details: errorData 
        });
    }
});

// --- ADMIN LOGS ENDPOINT ---
app.get('/api/admin/defense-logs', async (req, res) => {
    try {
        // Fetch last 1000 logs from Redis
        const logsData = await redis.lrange('admin_logs', 0, 999);
        
        // Upstash Redis automatically parses JSON if it was pushed as a stringified JSON object!
        // So logsData is ALREADY an array of objects. We don't need JSON.parse().
        // In case it's mixed (some strings, some objects), we handle it safely:
        const logs = logsData.map(log => typeof log === 'string' ? JSON.parse(log) : log);
        
        res.json(logs);
    } catch (error) {
        console.error('Failed to fetch logs from Redis', error);
        res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
    }
});

// --- FRONTEND CRASH REPORTER ---
app.post('/api/track-crash', async (req, res) => {
    try {
        const { message, url, line, col, stack } = req.body;
        
        const logEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            timestamp: new Date().toISOString(),
            method: 'CLIENT_CRASH',
            endpoint: url,
            status: 500, // Treat as an error in the UI
            ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            user_agent: req.headers['user-agent'] || 'Unknown',
            duration: 0,
            error_details: message
        };

        await redis.lpush('admin_logs', JSON.stringify(logEntry));
        await redis.ltrim('admin_logs', 0, 999);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Failed to log crash to Redis', error);
        res.status(500).json({ error: 'Failed to log crash' });
    }
});

// --- PROPERTY CHATS (REALTIME) ---
// 1. Get or Create a Chat
app.post('/api/chats', async (req, res) => {
    try {
        const { property_id, buyer_id, seller_id } = req.body;
        
        // Check if chat already exists between these two people (regardless of property)
        // They could have started it where one was buyer and one was seller, or vice versa
        const { data: existingChats, error: checkErr } = await supabase
            .from('chats')
            .select('*')
            .or(`and(buyer_id.eq.${buyer_id},seller_id.eq.${seller_id}),and(buyer_id.eq.${seller_id},seller_id.eq.${buyer_id})`)
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (checkErr) throw checkErr;
        
        if (existingChats && existingChats.length > 0) {
            return res.json(existingChats[0]);
        }
        
        // Create new chat
        const { data: newChat, error: insertErr } = await supabase
            .from('chats')
            .insert([{ property_id, buyer_id, seller_id }])
            .select()
            .single();
            
        if (insertErr) throw insertErr;
        res.status(201).json(newChat);
    } catch (error) {
        console.error("Chat Create Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. Get user's chats
app.get('/api/chats/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Fetch all chats where user is buyer or seller
        const { data, error } = await supabase
            .from('chats')
            .select('*, properties(*)')
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order('updated_at', { ascending: false });
            
        if (error) {
            console.error("Supabase Chat Fetch Error:", error);
            throw error;
        }

        // Manually fetch and attach profiles to avoid FK ambiguity errors
        const profileIds = new Set();
        data.forEach(chat => {
            if (chat.buyer_id) profileIds.add(chat.buyer_id);
            if (chat.seller_id) profileIds.add(chat.seller_id);
        });

        if (profileIds.size > 0) {
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', Array.from(profileIds));

            if (!profError && profiles) {
                const profileMap = {};
                profiles.forEach(p => profileMap[p.id] = p);
                
                data.forEach(chat => {
                    chat.buyer = profileMap[chat.buyer_id] || null;
                    chat.seller = profileMap[chat.seller_id] || null;
                });
            }
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Get messages for a chat
app.get('/api/chats/:chatId/messages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('chat_id', req.params.chatId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Send a message
app.post('/api/chats/:chatId/messages', async (req, res) => {
    try {
        const { sender_id, content } = req.body;
        const chat_id = req.params.chatId;
        
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([{ chat_id, sender_id, content }])
            .select()
            .single();
            
        if (error) throw error;
        
        // Update chat's updated_at
        await supabase.from('chats').update({ updated_at: new Date() }).eq('id', chat_id);
        
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`HouseHunt Backend running on port ${port}`);
});
