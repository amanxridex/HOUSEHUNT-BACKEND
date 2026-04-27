const axios = require('axios');
const GEMINI_API_KEY = 'AIzaSyCHK4oM3AmWEyNuZP9xo8JBvwjDFe0GeaE';

async function listModels() {
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        console.log("Available Models:", response.data.models.map(m => m.name));
    } catch (error) {
        console.error("Error Listing Models:", error.response ? error.response.data : error.message);
    }
}

listModels();
