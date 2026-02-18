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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
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
    
    // Initialize event and display ticket info
    Event.getEvent().then(event => {
      console.log(`📅 Event: ${event.name}`);
      
      // Display the first active ticket type (e.g., "FAST FAST")
      if (event.ticketTypes && event.ticketTypes.length > 0) {
        const firstTicket = event.ticketTypes.find(t => t.isActive) || event.ticketTypes[0];
        if (firstTicket) {
          console.log(`💰 Ticket: ${firstTicket.name} - ₦${firstTicket.price}`);
          console.log(`🎟️ Sold: ${firstTicket.sold}/${firstTicket.limit}`);
        } else {
          console.log(`ℹ️ No active ticket types found.`);
        }
      } else {
        console.log(`ℹ️ No ticket types configured yet.`);
      }
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
      types: 'GET /api/tickets/types',
      availability: 'GET /api/tickets/availability/:type?',
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