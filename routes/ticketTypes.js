const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Admin middleware
const adminAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token !== 'admin-token-123') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Get all ticket types (public)
router.get('/', async (req, res) => {
  try {
    const event = await Event.getEvent();
    res.json({
      success: true,
      data: event.ticketTypes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new ticket type (admin only)
router.post('/add', adminAuth, async (req, res) => {
  try {
    const { name, price, limit, description } = req.body;
    
    if (!name || !price || !limit) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, price and limit are required' 
      });
    }
    
    const event = await Event.getEvent();
    
    // Check if ticket type already exists
    const exists = event.ticketTypes.find(t => t.name === name);
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        message: `Ticket type "${name}" already exists` 
      });
    }
    
    event.ticketTypes.push({
      name,
      price,
      limit,
      description: description || '',
      sold: 0,
      isActive: true
    });
    
    await event.save();
    
    console.log(`✅ New ticket type added: ${name} - ₦${price} (Limit: ${limit})`);
    
    res.json({
      success: true,
      message: `Ticket type "${name}" added successfully`,
      data: event.ticketTypes
    });
  } catch (error) {
    console.error('Error adding ticket type:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update ticket type (admin only)
router.put('/update/:typeName', adminAuth, async (req, res) => {
  try {
    const { typeName } = req.params;
    const updates = req.body;
    
    const event = await Event.getEvent();
    const ticketType = event.ticketTypes.find(t => t.name === typeName);
    
    if (!ticketType) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket type not found' 
      });
    }
    
    // Update allowed fields
    if (updates.price !== undefined) ticketType.price = updates.price;
    if (updates.limit !== undefined) ticketType.limit = updates.limit;
    if (updates.description !== undefined) ticketType.description = updates.description;
    if (updates.isActive !== undefined) ticketType.isActive = updates.isActive;
    
    await event.save();
    
    res.json({
      success: true,
      message: `Ticket type "${typeName}" updated`,
      data: ticketType
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Deactivate ticket type (admin only)
router.delete('/deactivate/:typeName', adminAuth, async (req, res) => {
  try {
    const { typeName } = req.params;
    
    const event = await Event.getEvent();
    const ticketType = event.ticketTypes.find(t => t.name === typeName);
    
    if (!ticketType) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket type not found' 
      });
    }
    
    ticketType.isActive = false;
    await event.save();
    
    res.json({
      success: true,
      message: `Ticket type "${typeName}" deactivated`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset sold count for a ticket type (admin only)
router.post('/reset/:typeName', adminAuth, async (req, res) => {
  try {
    const { typeName } = req.params;
    
    const event = await Event.getEvent();
    const ticketType = event.ticketTypes.find(t => t.name === typeName);
    
    if (!ticketType) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket type not found' 
      });
    }
    
    ticketType.sold = 0;
    await event.save();
    
    res.json({
      success: true,
      message: `Sold count reset for "${typeName}"`,
      data: {
        name: ticketType.name,
        available: ticketType.limit,
        sold: ticketType.sold
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;