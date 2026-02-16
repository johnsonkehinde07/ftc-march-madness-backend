const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

// POST /api/validate
router.post('/', async (req, res) => {
  try {
    const { ticketId } = req.body;
    
    const ticket = await Ticket.findOne({ ticketId });
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Valid ticket',
      data: {
        ticketId: ticket.ticketId,
        name: ticket.name,
        scanned: ticket.scanned
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;