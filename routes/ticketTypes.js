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

// Get all ticket types
router.get('/', async (req, res) => {
  try {
    const event = await Event.getEvent();
    res.json({ success: true, data: event.ticketTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new ticket type
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

// Update ticket type
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

// Delete ticket type
router.delete('/delete/:typeName', adminAuth, async (req, res) => {
  try {
    const { typeName } = req.params;
    
    const event = await Event.getEvent();
    const initialLength = event.ticketTypes.length;
    
    event.ticketTypes = event.ticketTypes.filter(t => t.name !== typeName);
    
    if (event.ticketTypes.length === initialLength) {
      return res.status(404).json({ 
        success: false, 
        message: `Ticket type "${typeName}" not found` 
      });
    }
    
    await event.save();
    
    res.json({
      success: true,
      message: `Ticket type "${typeName}" deleted successfully`
    });
    
  } catch (error) {
    console.error('Error deleting ticket type:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting ticket type: ' + error.message 
    });
  }
});

// Restock ticket type (reset sold count)
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
    
    // Make sure it's active
    ticketType.isActive = true;
    
    await event.save();
    
    res.json({
      success: true,
      message: `✅ ${typeName} restocked successfully`,
      data: {
        name: ticketType.name,
        available: ticketType.limit - ticketType.sold,
        limit: ticketType.limit
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

// Set ticket type to SOLD OUT
router.post('/soldout/:typeName', adminAuth, async (req, res) => {
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
    
    // Set to sold out (inactive)
    ticketType.isActive = false;
    
    await event.save();
    
    console.log(`❌ ${typeName} marked as SOLD OUT`);
    
    res.json({
      success: true,
      message: `✅ ${typeName} marked as SOLD OUT`,
      data: {
        name: ticketType.name,
        isActive: ticketType.isActive,
        sold: ticketType.sold,
        limit: ticketType.limit
      }
    });
    
  } catch (error) {
    console.error('Sold out error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error marking as sold out: ' + error.message 
    });
  }
});

module.exports = router;