const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Supabase Client Initialization
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Using Service Role for Admin/Backend operations
);

app.use(cors());
app.use(express.json());

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

// Post a new property (Submitted by user, pending approval)
app.post('/api/properties', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('properties')
            .insert([{ ...req.body, status: 'pending' }]);
            
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ADMIN ROUTES (ADMIN PANEL) ---

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
        const { count: propertyCount } = await supabase.from('properties').select('*', { count: 'exact', head: true });
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        
        res.json({
            totalProperties: propertyCount,
            totalUsers: userCount,
            newUsersToday: 5,
            revenue: "₹ 45.8L"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- USER PROFILE ROUTES ---

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
        const { phone, name, email } = req.body;
        
        const { data, error } = await supabase
            .from('profiles')
            .upsert({ 
                id, 
                phone, 
                full_name: name, 
                email: email,
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

app.listen(port, () => {
    console.log(`HouseHunt Backend running on port ${port}`);
});
