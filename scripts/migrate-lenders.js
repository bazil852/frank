#!/usr/bin/env node

/**
 * Script to migrate lender data from Supabase to Pinecone
 * Run with: node scripts/migrate-lenders.js
 */

const https = require('https');

const API_URL = 'http://localhost:3000/api/migrate-lenders';

console.log('🚀 Starting lender data migration...');
console.log('📡 Calling migration API...');

// Make POST request to migration endpoint
const postData = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/migrate-lenders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = require('http').request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.success) {
        console.log('✅ Migration completed successfully!');
        console.log(`📈 Statistics:`);
        console.log(`   - Lenders processed: ${response.stats.lendersProcessed}`);
        console.log(`   - Chunks created: ${response.stats.chunksCreated}`);
        console.log(`   - Average chunks per lender: ${response.stats.avgChunksPerLender}`);
        console.log('🎉 Your Pinecone index now contains lender data for RAG!');
      } else {
        console.error('❌ Migration failed:', response.error);
        if (response.details) {
          console.error('📝 Details:', response.details);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      console.error('📄 Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('💡 Make sure your Next.js server is running on localhost:3001');
  process.exit(1);
});

req.write(postData);
req.end();