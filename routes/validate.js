const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

// POST /api/validate
router.post('/', async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ 
        success: false, 
        message: 'QR data is required' 
      });
    }

    // Try to parse the QR data (it could be JSON or just a ticket ID)
    let ticketId;
    try {
      // If it's JSON from your QR generator
      const parsed = JSON.parse(qrData);
      ticketId = parsed.ticketId;
    } catch (e) {
      // If it's just a plain ticket ID string
      ticketId = qrData.trim();
    }

    if (!ticketId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid QR code format' 
      });
    }

    // Find the ticket
    const ticket = await Ticket.findOne({ ticketId });
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }

    // Check if already scanned
    if (ticket.scanned) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket already used',
        data: {
          scannedAt: ticket.scannedAt,
          name: ticket.name
        }
      });
    }

    // Mark as scanned
    ticket.scanned = true;
    ticket.scannedAt = new Date();
    await ticket.save();

    // Success!
    res.json({
      success: true,
      message: 'Valid ticket - entry granted',
      data: {
        ticketId: ticket.ticketId,
        name: ticket.name,
        scanned: true,
        scannedAt: ticket.scannedAt
      }
    });

  } catch (error) {
    console.error('Validation Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during validation' 
    });
  }
});

module.exports = router;