const http = require('http');

const API_KEY = process.env.N8N_API_KEY || 'dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=';

const data = JSON.stringify({
  instagramId: 'test123',
  direction: 'inbound',
  messageText: 'Hello test',
  intent: 'greeting'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/integrations/instagram/interaction',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
