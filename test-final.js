const { MongoClient } = require('mongodb');

const uri = 'mongodb://abdulforex39_db_user:v4RCB0xHCNAtAjDB@ac-zcdbsl6-shard-00-00.7zzyn3z.mongodb.net:27017,ac-zcdbsl6-shard-00-01.7zzyn3z.mongodb.net:27017,ac-zcdbsl6-shard-00-02.7zzyn3z.mongodb.net:27017/ftc_march_madness?ssl=true&replicaSet=atlas-zcdbsl6-shard-0&authSource=admin&retryWrites=true&w=majority';

console.log('🔌 Connecting with MongoClient directly...');

const client = new MongoClient(uri, {
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000,
  directConnection: false
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB!');
    
    // Test the connection
    const db = client.db('ftc_march_madness');
    const collections = await db.listCollections().toArray();
    console.log('✅ Database access successful');
    console.log('Collections:', collections.map(c => c.name));
    
    await client.close();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

run();