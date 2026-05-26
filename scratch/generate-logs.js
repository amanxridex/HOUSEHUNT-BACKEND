

const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        headers: {
            'User-Agent': 'HouseHunt-Stress-Tester/1.0',
            'X-Forwarded-For': `192.168.1.${Math.floor(Math.random() * 255)}`
        }
    };

    if (data) {
        const postData = JSON.stringify(data);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
        console.log(`${method} ${path} - Status: ${res.statusCode}`);
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    if (data) {
        req.write(JSON.stringify(data));
    }
    req.end();
}

console.log("Starting Log Generator...");

setInterval(() => {
    const endpoints = [
        '/api/properties',
        '/api/track-view',
        '/api/hacker-attack',
        '/admin/wp-login.php', // Simulate a hacking attempt (404)
        '/api/properties?city=Mumbai'
    ];

    const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    makeRequest(randomEndpoint);
}, 1000);

setInterval(() => {
    makeRequest('/api/track-crash', 'POST', {
        message: 'TypeError: Cannot read properties of null (reading "value")',
        url: '/explore.html',
        line: 42,
        col: 15,
        stack: 'TypeError: Cannot read properties of null\n    at initMap (map.js:42:15)'
    });
}, 3500);
