const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');

// Admin middleware
const adminAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Admin login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
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

// Get all tickets
router.get('/tickets', adminAuth, async (req, res) => {
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

// Get detailed stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const event = await Event.getEvent();
    const tickets = await Ticket.find({ paymentStatus: 'paid' });
    
    // Calculate stats per ticket type
    const typeStats = {};
    event.ticketTypes.forEach(type => {
      const typeTickets = tickets.filter(t => t.ticketType === type.name);
      typeStats[type.name] = {
        sold: type.sold,
        limit: type.limit,
        remaining: type.limit - type.sold,
        revenue: typeTickets.length * type.price,
        scanned: typeTickets.filter(t => t.scanned).length
      };
    });
    
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
        failed: await Ticket.countDocuments({ paymentStatus: 'failed' }),
        byType: typeStats
      },
      sales: {
        totalRevenue: tickets.reduce((sum, t) => sum + t.price, 0),
        totalTickets: tickets.length,
        averagePrice: tickets.length > 0 
          ? tickets.reduce((sum, t) => sum + t.price, 0) / tickets.length 
          : 0
      }
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restock a specific ticket type
router.post('/restock/:typeName', adminAuth, async (req, res) => {
  try {
    const { typeName } = req.params;
    const { newLimit } = req.body;
    
    const event = await Event.getEvent();
    const ticketType = event.ticketTypes.find(t => t.name === typeName);
    
    if (!ticketType) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket type not found' 
      });
    }
    
    // Reset sold count
    ticketType.sold = 0;
    
    // Update limit if provided
    if (newLimit) {
      ticketType.limit = newLimit;
    }
    
    // Check overall event status
    const allSoldOut = event.ticketTypes.every(t => 
      !t.isActive || t.sold >= t.limit
    );
    event.status = allSoldOut ? 'sold_out' : 'active';
    
    await event.save();
    
    res.json({
      success: true,
      message: `✅ ${typeName} tickets restocked successfully`,
      data: {
        name: ticketType.name,
        available: ticketType.limit,
        sold: ticketType.sold,
        limit: ticketType.limit,
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

// Get single ticket by ID
router.get('/tickets/:id', adminAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ 
      $or: [
        { ticketId: req.params.id },
        { _id: req.params.id }
      ]
    });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manually mark ticket as scanned (for door issues)
router.post('/mark-scanned/:ticketId', adminAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (ticket.scanned) {
      return res.status(400).json({ 
        message: 'Ticket already scanned', 
        scannedAt: ticket.scannedAt 
      });
    }
    
    ticket.scanned = true;
    ticket.scannedAt = new Date();
    ticket.scannedBy = 'admin';
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket marked as scanned',
      data: {
        ticketId: ticket.ticketId,
        name: ticket.name,
        scannedAt: ticket.scannedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;