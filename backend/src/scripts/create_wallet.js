#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Get command line arguments
const chainType = process.argv[2] || 'ethereum';

// Get Privy credentials from environment variables
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error(JSON.stringify({
    error: 'Privy API credentials not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET in .env'
  }));
  process.exit(1);
}

// Create authorization header
const authHeader = `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`;

// Request options
const options = {
  hostname: 'api.privy.io',
  port: 443,
  path: '/v1/wallets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'privy-app-id': PRIVY_APP_ID,
    'Authorization': authHeader
  }
};

// Request data
const data = JSON.stringify({
  chain_type: chainType
});

// Make the request
const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(responseData);
    } else {
      console.error(JSON.stringify({
        error: `Request failed with status code ${res.statusCode}`,
        response: responseData
      }));
    }
  });
});

req.on('error', (error) => {
  console.error(JSON.stringify({
    error: error.message
  }));
});

// Write data to request body
req.write(data);
req.end(); 