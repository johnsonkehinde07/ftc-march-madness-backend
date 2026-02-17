const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5500',
    'https://ftc-march-madness.netlify.app'
  ],
  credentials: true
}));

// THESE TWO LINES ARE CRITICAL - THEY WERE MISSING!
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - USING .ENV VARIABLE
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔄 Connecting to MongoDB...');

// Import models
const Event = require('./models/Event');

mongoose.connect(MONGODB_URI, {
  family: 4,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000
})
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
    
    // Initialize event
    Event.getEvent().then(event => {
      console.log(`📅 Event: ${event.name}`);
      console.log(`💰 Price: ₦${event.firstBatch.price}`);
      console.log(`🎟️ Tickets: ${event.firstBatch.sold}/${event.firstBatch.limit}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });

// Routes
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/validate', require('./routes/validate'));
app.use('/api/webhook', require('./routes/webhook'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'FTC MARCH MADNESS API Running',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🔥 FTC MARCH MADNESS API',
    endpoints: {
      health: 'GET /api/health',
      availability: 'GET /api/tickets/availability',
      purchase: 'POST /api/tickets/purchase',
      check: 'GET /api/tickets/check/:email',
      validate: 'POST /api/validate',
      admin: {
        login: 'POST /api/admin/login',
        tickets: 'GET /api/admin/tickets',
        stats: 'GET /api/admin/stats'
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});