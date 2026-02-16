const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://abdulforex39_db_user:v4RCB0xHCNAtAjDB@ac-zcdbsl6-shard-00-00.7zzyn3z.mongodb.net:27017,ac-zcdbsl6-shard-00-01.7zzyn3z.mongodb.net:27017,ac-zcdbsl6-shard-00-02.7zzyn3z.mongodb.net:27017/ftc_march_madness?ssl=true&replicaSet=atlas-zcdbsl6-shard-0&authSource=admin&retryWrites=true&w=majority';

console.log('🔌 Testing MongoDB connection...');
console.log('Attempting to connect...');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  family: 4,
  tls: true,
  tlsAllowInvalidCertificates: true, // Add this for Node.js 24+
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
})
.then(() => {
  console.log('✅ SUCCESS: Connected to MongoDB!');
  console.log('Database:', mongoose.connection.name);
  process.exit(0);
})
.catch(err => {
  console.error('❌ FAILED:', err.message);
  process.exit(1);
});