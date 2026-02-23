Validate 
const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

// POST /api/validate
router.post('/', async (req, res) => {
  try {
    const { qrData, shortCode } = req.body;
    
    // Log what we received for debugging
    console.log('🔍 Validation request received:', { 
      hasQrData: !!qrData, 
      hasShortCode: !!shortCode,
      shortCode: shortCode || 'N/A'
    });
    
    // Validate that we have something to search with
    if (!qrData && !shortCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either QR data or short code is required' 
      });
    }

    let ticket;
    let searchMethod = '';

    // CASE 1: Search by short code (6-character code)
    if (shortCode) {
      searchMethod = 'shortCode';
      const cleanShortCode = shortCode.trim().toUpperCase();
      console.log(`🔎 Searching by short code: ${cleanShortCode}`);
      
      ticket = await Ticket.findOne({ shortCode: cleanShortCode });
      
      if (!ticket) {
        console.log(`❌ No ticket found with short code: ${cleanShortCode}`);
      }
    }
    
    // CASE 2: Search by QR data (JSON or plain ticket ID)
    else if (qrData) {
      searchMethod = 'qrData';
      let ticketId;
      
      try {
        // Try to parse as JSON (from QR code)
        const parsed = JSON.parse(qrData);
        ticketId = parsed.ticketId;
        console.log(`🔎 Parsed JSON QR data, ticketId: ${ticketId}`);
      } catch (e) {
        // If not JSON, treat as plain ticket ID string
        ticketId = qrData.trim();
        console.log(`🔎 Using plain ticket ID: ${ticketId}`);
      }

      if (!ticketId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid QR code format - no ticket ID found' 
        });
      }

      ticket = await Ticket.findOne({ ticketId });
      
      if (!ticket) {
        console.log(`❌ No ticket found with ID: ${ticketId}`);
      }
    }

    // If no ticket found by either method
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }

    console.log(`✅ Ticket found via ${searchMethod}:`, {
      ticketId: ticket.ticketId,
      shortCode: ticket.shortCode,
      name: ticket.name,
      paymentStatus: ticket.paymentStatus,
      scanned: ticket.scanned
    });

    // Check if payment status is paid (only paid tickets are valid)
    if (ticket.paymentStatus !== 'paid') {
      return res.status(400).json({ 
        success: false, 
        message: `Ticket is not paid (status: ${ticket.paymentStatus})` 
      });
    }

    // Check if already scanned
    if (ticket.scanned) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket already used',
        data: {
          scannedAt: ticket.scannedAt,
          name: ticket.name,
          ticketId: ticket.ticketId,
          shortCode: ticket.shortCode
        }
      });
    }

    // Mark as scanned
    ticket.scanned = true;
    ticket.scannedAt = new Date();
    await ticket.save();

    console.log(`✅ Ticket ${ticket.ticketId} marked as scanned at ${ticket.scannedAt}`);

    // Success response
    res.json({
      success: true,
      message: 'Valid ticket - entry granted',
      data: {
        ticketId: ticket.ticketId,
        shortCode: ticket.shortCode || ticket.ticketId.slice(-6),
        name: ticket.name,
        ticketType: ticket.ticketType,
        scanned: true,
        scannedAt: ticket.scannedAt
      }
    });

  } catch (error) {
    console.error('❌ Validation Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during validation' 
    });
  }
});

// Optional: GET endpoint to check ticket by short code (useful for manual checks)
router.get('/shortcode/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = code.trim().toUpperCase();
    
    const ticket = await Ticket.findOne({ shortCode: cleanCode });
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'No ticket found with that short code' 
      });
    }
    
    res.json({
      success: true,
      data: {
        ticketId: ticket.ticketId,
        shortCode: ticket.shortCode,
        name: ticket.name,
        ticketType: ticket.ticketType,
        paymentStatus: ticket.paymentStatus,
        scanned: ticket.scanned,
        scannedAt: ticket.scannedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Short Code Lookup Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Optional: GET endpoint to check ticket by email (for door staff)
router.get('/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const cleanEmail = email.trim().toLowerCase();
    
    const tickets = await Ticket.find({ 
      email: cleanEmail,
      paymentStatus: 'paid'
    });
    
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No paid tickets found for that email' 
      });
    }
    
    res.json({
      success: true,
      count: tickets.length,
      data: tickets.map(t => ({
        ticketId: t.ticketId,
        shortCode: t.shortCode || t.ticketId.slice(-6),
        name: t.name,
        ticketType: t.ticketType,
        scanned: t.scanned,
        scannedAt: t.scannedAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Email Lookup Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;