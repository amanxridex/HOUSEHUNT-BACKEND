const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

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

app.listen(port, () => {
    console.log(`HouseHunt Backend running on port ${port}`);
});
