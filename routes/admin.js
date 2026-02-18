const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const sendTicketEmail = require('../utils/emailResend');

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
    
    // Count paid tickets properly
    const paidTickets = await Ticket.find({ paymentStatus: 'paid' });
    const pendingTickets = await Ticket.countDocuments({ paymentStatus: 'pending' });
    const failedTickets = await Ticket.countDocuments({ paymentStatus: 'failed' });
    
    // Calculate stats per ticket type
    const typeStats = {};
    
    // Get all unique ticket types from tickets collection
    const ticketTypes = await Ticket.distinct('ticketType');
    
    for (const type of ticketTypes) {
      const typeTickets = paidTickets.filter(t => t.ticketType === type);
      const eventType = event.ticketTypes.find(t => t.name === type);
      
      typeStats[type] = {
        sold: typeTickets.length,
        limit: eventType ? eventType.limit : 0,
        remaining: eventType ? eventType.limit - typeTickets.length : 0,
        revenue: typeTickets.reduce((sum, t) => sum + t.price, 0),
        scanned: typeTickets.filter(t => t.scanned).length
      };
    }
    
    // Also include any types from event that have no tickets yet
    event.ticketTypes.forEach(type => {
      if (!typeStats[type.name]) {
        typeStats[type.name] = {
          sold: 0,
          limit: type.limit,
          remaining: type.limit,
          revenue: 0,
          scanned: 0
        };
      }
    });
    
    const totalRevenue = paidTickets.reduce((sum, t) => sum + t.price, 0);
    
    const stats = {
      event: {
        name: event.name,
        date: event.date,
        location: event.location,
        status: event.status
      },
      tickets: {
        total: paidTickets.length,
        scanned: paidTickets.filter(t => t.scanned).length,
        pending: pendingTickets,
        failed: failedTickets,
        byType: typeStats
      },
      sales: {
        totalRevenue: totalRevenue,
        totalTickets: paidTickets.length,
        averagePrice: paidTickets.length > 0 
          ? Math.round(totalRevenue / paidTickets.length) 
          : 0
      }
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// NEW: Resend tickets to all paid customers
router.post('/resend-all-tickets', adminAuth, async (req, res) => {
  try {
    const { email } = req.body; // Optional: send to specific email only
    
    console.log('📨 Starting ticket resend process...');
    
    // Build query - find paid tickets that need QR codes or emails
    let query = { 
      paymentStatus: 'paid',
      $or: [
        { qrCode: { $exists: false } },
        { qrCode: null },
        { qrCode: '' }
      ]
    };
    
    if (email) {
      query.email = email;
      console.log(`🔍 Filtering for email: ${email}`);
    }
    
    // Find tickets needing processing
    const tickets = await Ticket.find(query);
    
    if (tickets.length === 0) {
      return res.json({ 
        success: true, 
        message: '✅ All paid tickets already have QR codes and emails' 
      });
    }
    
    console.log(`📊 Found ${tickets.length} tickets needing processing`);
    
    // Group by bulkOrderId or email
    const groups = {};
    tickets.forEach(t => {
      const key = t.bulkOrderId || t.email;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    
    console.log(`📧 Will send ${Object.keys(groups).length} email(s)`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // Process each group
    for (const [groupKey, groupTickets] of Object.entries(groups)) {
      try {
        console.log(`\n🔄 Processing group: ${groupKey} (${groupTickets.length} tickets)`);
        
        // Generate QR codes for tickets that don't have them
        for (const ticket of groupTickets) {
          if (!ticket.qrCode) {
            console.log(`  Generating QR for ticket ${ticket.ticketId}...`);
            const qrResult = await generateQRCode(ticket);
            ticket.qrCode = qrResult.qrCode;
            ticket.qrCodeData = qrResult.qrData;
            await ticket.save();
            console.log(`  ✅ QR generated for ${ticket.ticketId}`);
          }
        }
        
        // Send email with all tickets in this group
        const primaryTicket = groupTickets[0];
        console.log(`  📧 Sending email to ${primaryTicket.email}...`);
        
        const emailSent = await sendTicketEmail(groupTickets, primaryTicket);
        
        if (emailSent) {
          // Mark all tickets as emailed
          for (const ticket of groupTickets) {
            ticket.emailSent = true;
            ticket.emailSentAt = new Date();
            await ticket.save();
          }
          successCount += groupTickets.length;
          console.log(`  ✅ Email sent successfully to ${primaryTicket.email}`);
          results.push({
            email: primaryTicket.email,
            count: groupTickets.length,
            success: true
          });
        } else {
          failCount += groupTickets.length;
          console.log(`  ❌ Failed to send email to ${primaryTicket.email}`);
          results.push({
            email: primaryTicket.email,
            count: groupTickets.length,
            success: false
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (groupError) {
        console.error(`❌ Error processing group ${groupKey}:`, groupError.message);
        failCount += groupTickets.length;
        results.push({
          group: groupKey,
          error: groupError.message,
          success: false
        });
      }
    }
    
    console.log('\n📊 Process complete!');
    console.log(`✅ Successful: ${successCount} tickets`);
    console.log(`❌ Failed: ${failCount} tickets`);
    
    res.json({
      success: true,
      message: `Processed ${tickets.length} tickets`,
      summary: {
        total: tickets.length,
        successful: successCount,
        failed: failCount,
        emailsSent: results.length
      },
      results
    });
    
  } catch (error) {
    console.error('❌ Fatal error in resend-all-tickets:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error resending tickets: ' + error.message 
    });
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
    
    // Reset sold count based on actual paid tickets
    const paidCount = await Ticket.countDocuments({ 
      ticketType: typeName, 
      paymentStatus: 'paid' 
    });
    
    ticketType.sold = paidCount;
    
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
        available: ticketType.limit - ticketType.sold,
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

// NEW: Manually send ticket to a specific email
router.post('/send-ticket/:ticketId', adminAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    if (!ticket.qrCode) {
      const qrResult = await generateQRCode(ticket);
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
    }
    
    const emailSent = await sendTicketEmail([ticket], ticket);
    
    if (emailSent) {
      ticket.emailSent = true;
      ticket.emailSentAt = new Date();
      await ticket.save();
      
      res.json({
        success: true,
        message: `✅ Ticket sent to ${ticket.email}`
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send email' 
      });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;