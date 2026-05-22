const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const imagePool = {
    'Apartment': [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1e5250ce07?w=800&q=80',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80'
    ],
    'Independent House': [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80'
    ],
    'Villa': [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
        'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80'
    ],
    'Commercial': [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
        'https://images.unsplash.com/photo-1572025442646-866d16c84a54?w=800&q=80'
    ],
    'Plot': [
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
        'https://images.unsplash.com/photo-1592659762303-90081d34b277?w=800&q=80',
        'https://images.unsplash.com/photo-1629087579124-b15dd3cbab1e?w=800&q=80'
    ]
};

const cities = ['Noida', 'Gurgaon', 'Delhi', 'Mumbai', 'Bangalore'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generatePrice(intent, type) {
    if (intent === 'Rent') {
        return Math.floor(Math.random() * 50000) + 10000;
    } else {
        return Math.floor(Math.random() * 50000000) + 5000000;
    }
}

async function seed() {
    console.log("Starting seed process...");

    // 1. Get or create a user profile
    let { data: profiles, error: profileError } = await supabase.from('profiles').select('id').limit(1);
    let ownerId;
    if (profileError || !profiles || profiles.length === 0) {
        console.log("No profiles found. Creating a mock profile...");
        const newProfileId = 'mock-user-' + Date.now();
        const { data: newProfile, error: insertError } = await supabase.from('profiles').insert([
            { id: newProfileId, full_name: 'Mock User', email: 'mockuser@example.com', role: 'seller' }
        ]).select('id').single();
        if (insertError) {
            console.error("Error creating profile:", insertError);
            return;
        }
        ownerId = newProfile.id;
    } else {
        ownerId = profiles[0].id;
    }
    console.log(`Using owner_id: ${ownerId}`);

    const properties = [];
    const combinations = [
        { type: 'Apartment', intent: 'Rent' }, { type: 'Apartment', intent: 'Buy' },
        { type: 'Independent House', intent: 'Rent' }, { type: 'Independent House', intent: 'Buy' },
        { type: 'Villa', intent: 'Rent' }, { type: 'Villa', intent: 'Buy' },
        { type: 'Commercial', intent: 'Rent' }, { type: 'Commercial', intent: 'Buy' },
        { type: 'Plot', intent: 'Buy' }
    ];

    for (const combo of combinations) {
        for (let i = 1; i <= 5; i++) {
            const city = getRandomItem(cities);
            const price = generatePrice(combo.intent, combo.type);
            properties.push({
                owner_id: ownerId,
                title: `Beautiful ${combo.type} for ${combo.intent} in ${city}`,
                description: `This is a fantastic ${combo.type} located in the heart of ${city}. It features modern amenities and is perfectly suited for your needs. A great opportunity to ${combo.intent.toLowerCase()} a premium property!`,
                property_type: combo.type,
                intent: combo.intent,
                price: price,
                location_text: `Sector ${Math.floor(Math.random() * 100) + 1}, ${city}`,
                city: city,
                images: [getRandomItem(imagePool[combo.type]), getRandomItem(imagePool[combo.type])],
                status: 'approved',
                details: { bedrooms: Math.floor(Math.random() * 4) + 1, bathrooms: Math.floor(Math.random() * 3) + 1 }
            });
        }
    }

    console.log(`Inserting ${properties.length} properties...`);
    const { data, error } = await supabase.from('properties').insert(properties);

    if (error) {
        console.error("Error inserting properties:", error);
    } else {
        console.log("Successfully inserted 45 mock properties!");
    }
}

seed();
