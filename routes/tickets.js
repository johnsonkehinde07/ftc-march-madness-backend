const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const axios = require('axios');

// Paystack initialization function
const initializePayment = async (email, amount, metadata) => {
  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: email,
      amount: amount * 100,
      metadata: metadata,
      callback_url: 'https://ftc-march-madness.netlify.app/payment-callback.html'
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Paystack Error:', error.response?.data || error.message);
    throw error;
  }
};

// Verify payment function
const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Verification Error:', error.response?.data || error.message);
    throw error;
  }
};

// GET available ticket types
router.get('/types', async (req, res) => {
  try {
    const event = await Event.getEvent();
    const availableTypes = event.ticketTypes
      .filter(t => t.isActive)
      .map(t => ({
        name: t.name,
        price: t.price,
        available: t.limit - t.sold,
        limit: t.limit,
        sold: t.sold,
        description: t.description
      }));
    
    res.json({
      success: true,
      data: availableTypes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check availability for a specific ticket type
router.get('/availability/:type?', async (req, res) => {
  try {
    const event = await Event.getEvent();
    const { type } = req.params;
    
    if (type) {
      const ticketType = event.getTicketType(type);
      if (!ticketType) {
        return res.status(404).json({ 
          success: false, 
          message: 'Ticket type not found' 
        });
      }
      
      res.json({
        success: true,
        data: {
          name: ticketType.name,
          price: ticketType.price,
          available: ticketType.limit - ticketType.sold,
          sold: ticketType.sold,
          limit: ticketType.limit
        }
      });
    } else {
      // Return all types
      const allTypes = event.ticketTypes.map(t => ({
        name: t.name,
        price: t.price,
        available: t.limit - t.sold,
        sold: t.sold,
        limit: t.limit,
        isActive: t.isActive
      }));
      
      res.json({
        success: true,
        data: allTypes
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Initialize ticket purchase (redirect to Paystack)
router.post('/purchase', async (req, res) => {
  try {
    const { name, email, phone, ticketType } = req.body;
    
    console.log('📝 Purchase request received:', { name, email, phone, ticketType });
    
    if (!name || !email || !ticketType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email and ticket type are required' 
      });
    }
    
    const event = await Event.getEvent();
    
    // Find the selected ticket type
    const selectedType = event.ticketTypes.find(t => 
      t.name === ticketType && t.isActive
    );
    
    if (!selectedType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or unavailable ticket type' 
      });
    }
    
    // Check availability
    if (selectedType.sold >= selectedType.limit) {
      return res.status(400).json({ 
        success: false, 
        message: `${selectedType.name} tickets are sold out` 
      });
    }
    
    // Create ticket with pending status
    const ticket = new Ticket({
      name,
      email,
      phone,
      ticketType: selectedType.name,
      price: selectedType.price,
      ticketId: 'FTC' + Date.now() + Math.floor(Math.random() * 1000),
      paymentStatus: 'pending'
    });
    
    await ticket.save();
    console.log(`🎫 Ticket created: ${ticket.ticketId} for ${email} (${selectedType.name})`);
    
    // Add checkout fee (₦300)
    const checkoutFee = 300;
    const totalAmount = selectedType.price + checkoutFee;
    
    console.log(`💰 Amount breakdown: ${selectedType.name} ₦${selectedType.price} + Fee ₦${checkoutFee} = Total ₦${totalAmount}`);
    
    // Initialize Paystack payment
    const payment = await initializePayment(email, totalAmount, {
      ticketId: ticket.ticketId,
      name: name,
      phone: phone,
      ticketType: selectedType.name,
      ticketPrice: selectedType.price,
      checkoutFee: checkoutFee
    });
    
    if (payment.status) {
      const paystackReference = payment.data.reference;
      
      if (!paystackReference) {
        console.error('❌ No reference from Paystack!');
        throw new Error('No payment reference received');
      }
      
      console.log(`💰 Paystack reference: ${paystackReference}`);
      
      ticket.paymentReference = paystackReference;
      await ticket.save();
      
      const verifyTicket = await Ticket.findById(ticket._id);
      console.log(`✅ Payment reference saved: ${verifyTicket.paymentReference} for ticket ${verifyTicket.ticketId}`);
      
      res.json({
        success: true,
        message: 'Redirect to payment',
        data: {
          ticketId: ticket.ticketId,
          ticketType: selectedType.name,
          displayPrice: selectedType.price,
          authorization_url: payment.data.authorization_url,
          reference: paystackReference
        }
      });
    } else {
      throw new Error('Payment initialization failed');
    }
    
  } catch (error) {
    console.error('❌ Purchase Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing purchase: ' + error.message 
    });
  }
});

// Verify payment after Paystack redirect
router.post('/verify-payment', async (req, res) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment reference required' 
      });
    }
    
    console.log(`🔍 Verifying payment: ${reference}`);
    
    // Find ticket by reference
    let ticket = await Ticket.findOne({ paymentReference: reference });
    
    if (!ticket) {
      console.log(`❌ No ticket found for reference: ${reference}`);
      
      const verification = await verifyPayment(reference).catch(() => null);
      if (verification && verification.data) {
        const customerEmail = verification.data.customer?.email;
        const metadata = verification.data.metadata || {};
        
        if (metadata.ticketId) {
          ticket = await Ticket.findOne({ ticketId: metadata.ticketId });
        }
        
        if (!ticket && customerEmail) {
          console.log(`🔍 Looking for recent tickets with email: ${customerEmail}`);
          const recentTicket = await Ticket.findOne({ 
            email: customerEmail,
            paymentStatus: 'pending'
          }).sort({ createdAt: -1 });
          
          if (recentTicket) {
            console.log(`✅ Found recent ticket: ${recentTicket.ticketId}`);
            ticket = recentTicket;
            ticket.paymentReference = reference;
            await ticket.save();
          }
        }
      }
      
      if (!ticket) {
        return res.status(404).json({ 
          success: false, 
          message: 'Ticket not found' 
        });
      }
    }
    
    if (ticket.paymentStatus === 'paid') {
      console.log(`✅ Ticket ${ticket.ticketId} already paid`);
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          ticketId: ticket.ticketId,
          name: ticket.name,
          email: ticket.email,
          ticketType: ticket.ticketType,
          price: ticket.price
        }
      });
    }
    
    const verification = await verifyPayment(reference);
    
    if (verification.data.status === 'success') {
      const generateQRCode = require('../utils/qrGenerator');
      const sendTicketEmail = require('../utils/emailResend');
      
      const qrResult = await generateQRCode(ticket);
      
      ticket.paymentStatus = 'paid';
      ticket.paidAt = new Date();
      ticket.qrCode = qrResult.qrCode;
      ticket.qrCodeData = qrResult.qrData;
      await ticket.save();
      
      console.log(`📧 Sending email via Resend to ${ticket.email}...`);
      sendTicketEmail(ticket, qrResult.qrCode)
        .then(success => {
          if (success) {
            console.log(`✅ Email sent successfully to ${ticket.email}`);
          } else {
            console.log(`❌ Email failed to send to ${ticket.email}`);
          }
        })
        .catch(err => {
          console.log('Email sending error:', err.message);
        });
      
      const event = await Event.getEvent();
      await event.incrementSold(ticket.ticketType);
      
      console.log(`✅ Ticket ${ticket.ticketId} (${ticket.ticketType}) verified and completed`);
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          ticketId: ticket.ticketId,
          name: ticket.name,
          email: ticket.email,
          ticketType: ticket.ticketType,
          price: ticket.price
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
    
  } catch (error) {
    console.error('❌ Verification Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying payment: ' + error.message 
    });
  }
});

// Check ticket by email
router.get('/check/:email', async (req, res) => {
  try {
    const tickets = await Ticket.find({ 
      email: req.params.email.toLowerCase(),
      paymentStatus: 'paid'
    });
    
    if (!tickets || tickets.length === 0) {
      return res.json({
        success: true,
        hasTicket: false,
        message: 'No paid ticket found for this email'
      });
    }
    
    res.json({
      success: true,
      hasTicket: true,
      count: tickets.length,
      data: tickets.map(t => ({
        ticketId: t.ticketId,
        name: t.name,
        ticketType: t.ticketType,
        scanned: t.scanned,
        scannedAt: t.scannedAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;