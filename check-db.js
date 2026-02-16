require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔍 Testing MongoDB Connection...');
console.log('URI starts with:', MONGODB_URI ? MONGODB_URI.substring(0, 50) : '❌ No URI found');
console.log('Attempting to connect...');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000
})
.then(() => {
  console.log('✅ SUCCESS: Connected to MongoDB!');
  console.log('Database:', mongoose.connection.name);
  process.exit(0);
})
.catch(err => {
  console.error('❌ FAILED:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});