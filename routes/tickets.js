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
      callback_url: 'https://ftc-march-madness-frontend.onrender.com/payment-callback.html' // UPDATED
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
      const ticketType = event.ticketTypes.find(t => t.name === type && t.isActive);
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

// Initialize ticket purchase with quantity support
router.post('/purchase', async (req, res) => {
  try {
    const { name, email, phone, ticketType, quantity } = req.body;
    
    console.log('📝 Purchase request received:', { name, email, phone, ticketType, quantity });
    
    if (!name || !email || !ticketType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email and ticket type are required' 
      });
    }
    
    // Validate quantity
    const ticketQuantity = quantity || 1;
    if (ticketQuantity < 1 || ticketQuantity > 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quantity must be between 1 and 10' 
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
    
    // Check availability for quantity
    if (selectedType.sold + ticketQuantity > selectedType.limit) {
      return res.status(400).json({ 
        success: false, 
        message: `Only ${selectedType.limit - selectedType.sold} tickets left` 
      });
    }
    
    // Generate bulk order ID (same for all tickets in this purchase)
    const bulkOrderId = 'BULK' + Date.now() + Math.floor(Math.random() * 10000);
    
    // Create multiple tickets
    const tickets = [];
    for (let i = 0; i < ticketQuantity; i++) {
      const ticket = new Ticket({
        name,
        email,
        phone,
        ticketType: selectedType.name,
        price: selectedType.price,
        ticketId: 'FTC' + Date.now() + Math.floor(Math.random() * 10000) + i,
        paymentStatus: 'pending',
        bulkOrderId,
        quantity: ticketQuantity
      });
      tickets.push(ticket);
    }
    
    // Save all tickets
    await Ticket.insertMany(tickets);
    console.log(`🎫 Created ${ticketQuantity} tickets for ${email} (${selectedType.name})`);
    
    // Calculate total with fee
    const checkoutFee = 300;
    const totalAmount = (selectedType.price * ticketQuantity) + checkoutFee;
    
    console.log(`💰 Amount: ${ticketQuantity} x ₦${selectedType.price} + ₦${checkoutFee} fee = ₦${totalAmount}`);
    
    // Initialize Paystack payment with metadata containing bulk info
    const payment = await initializePayment(email, totalAmount, {
      bulkOrderId,
      name,
      phone,
      ticketType: selectedType.name,
      quantity: ticketQuantity,
      unitPrice: selectedType.price,
      checkoutFee
    });
    
    if (payment.status) {
      const paystackReference = payment.data.reference;
      
      if (!paystackReference) {
        console.error('❌ No reference from Paystack!');
        throw new Error('No payment reference received');
      }
      
      console.log(`💰 Paystack reference: ${paystackReference}`);
      
      // Update all tickets with payment reference
      await Ticket.updateMany(
        { bulkOrderId },
        { $set: { paymentReference: paystackReference } }
      );
      
      res.json({
        success: true,
        message: 'Redirect to payment',
        data: {
          bulkOrderId,
          quantity: ticketQuantity,
          unitPrice: selectedType.price,
          totalAmount,
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
    
    // Find all tickets with this payment reference
    let tickets = await Ticket.find({ paymentReference: reference });
    
    if (!tickets || tickets.length === 0) {
      console.log(`❌ No tickets found for reference: ${reference}`);
      
      // Try fallback by checking Paystack
      const verification = await verifyPayment(reference).catch(() => null);
      if (verification && verification.data) {
        const metadata = verification.data.metadata || {};
        if (metadata.bulkOrderId) {
          tickets = await Ticket.find({ bulkOrderId: metadata.bulkOrderId });
        }
      }
      
      if (!tickets || tickets.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Tickets not found' 
        });
      }
    }
    
    // Check if already paid
    if (tickets[0].paymentStatus === 'paid') {
      console.log(`✅ Tickets already paid`);
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          count: tickets.length,
          tickets: tickets.map(t => ({
            ticketId: t.ticketId,
            name: t.name,
            ticketType: t.ticketType
          }))
        }
      });
    }
    
    // Verify with Paystack
    const verification = await verifyPayment(reference);
    
    if (verification.data.status === 'success') {
      const generateQRCode = require('../utils/qrGenerator');
      const sendTicketEmail = require('../utils/emailResend');
      
      // Process each ticket
      const completedTickets = [];
      for (const ticket of tickets) {
        // Generate QR code
        const qrResult = await generateQRCode(ticket);
        
        // Update ticket
        ticket.paymentStatus = 'paid';
        ticket.paidAt = new Date();
        ticket.qrCode = qrResult.qrCode;
        ticket.qrCodeData = qrResult.qrData;
        await ticket.save();
        completedTickets.push(ticket);
        
        console.log(`✅ Ticket ${ticket.ticketId} completed`);
      }
      
      // Send single email with all tickets
      console.log(`📧 Sending email with ${completedTickets.length} tickets to ${tickets[0].email}...`);
      
      // Update event count using actual paid tickets
      const event = await Event.getEvent();
      const ticketType = event.ticketTypes.find(t => t.name === tickets[0].ticketType);
      
      if (ticketType) {
        // Count ALL paid tickets of this type (not just this batch)
        const totalPaidForType = await Ticket.countDocuments({ 
          ticketType: tickets[0].ticketType, 
          paymentStatus: 'paid' 
        });
        
        ticketType.sold = totalPaidForType;
        await event.save();
        console.log(`✅ Updated ${tickets[0].ticketType} sold count to ${totalPaidForType}`);
      } else {
        console.log(`⚠️ Ticket type ${tickets[0].ticketType} not found in event`);
      }
      
      // Send email with all tickets
      try {
        await sendTicketEmail(completedTickets, tickets[0]);
        console.log(`✅ Email sent successfully to ${tickets[0].email}`);
      } catch (emailError) {
        console.log(`⚠️ Email sending failed but tickets are paid:`, emailError.message);
      }
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          count: completedTickets.length,
          tickets: completedTickets.map(t => ({
            ticketId: t.ticketId,
            name: t.name,
            ticketType: t.ticketType
          }))
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