const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');

// Admin login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Simple check (in real app, use proper authentication)
  if (email === 'admin@ftcmarch.com' && password === 'ftc2026march') {
    res.json({
      success: true,
      token: 'admin-token-123'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Get all tickets (protected route)
router.get('/tickets', async (req, res) => {
  const token = req.header('x-auth-token');
  
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get stats (protected route)
router.get('/stats', async (req, res) => {
  const token = req.header('x-auth-token');
  
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    const event = await Event.getEvent();
    const tickets = await Ticket.find({ paymentStatus: 'paid' });
    
    const stats = {
      event: {
        name: event.name,
        date: event.date,
        location: event.location,
        status: event.status
      },
      tickets: {
        total: tickets.length,
        scanned: tickets.filter(t => t.scanned).length,
        pending: await Ticket.countDocuments({ paymentStatus: 'pending' }),
        paid: tickets.length
      },
      sales: {
        sold: event.firstBatch.sold,
        limit: event.firstBatch.limit,
        remaining: event.firstBatch.limit - event.firstBatch.sold,
        revenue: tickets.length * event.firstBatch.price
      }
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// RESTOCK TICKETS - ADD THIS ENDPOINT
router.post('/restock', async (req, res) => {
  const token = req.header('x-auth-token');
  
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    const { newLimit } = req.body;
    
    // Get the event
    const event = await Event.getEvent();
    
    // Reset sold count to 0
    event.firstBatch.sold = 0;
    
    // Update limit if provided
    if (newLimit) {
      event.firstBatch.limit = newLimit;
    }
    
    // Set status back to active
    event.status = 'active';
    
    await event.save();
    
    res.json({
      success: true,
      message: '✅ Tickets restocked successfully',
      data: {
        available: event.firstBatch.limit,
        sold: event.firstBatch.sold,
        limit: event.firstBatch.limit,
        status: event.status
      }
    });
    
  } catch (error) {
    console.error('Restock Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error restocking tickets: ' + error.message 
    });
  }
});

module.exports = router;