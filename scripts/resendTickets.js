const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const generateQRCode = require('../utils/qrGenerator');
const sendTicketEmail = require('../utils/emailResend');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Connection error:', err));

async function resendTicketsToPaidCustomers() {
  try {
    console.log('🔍 Finding all paid tickets without emails...');
    
    // Find all paid tickets that don't have QR codes or haven't been emailed
    const paidTickets = await Ticket.find({ 
      paymentStatus: 'paid',
      $or: [
        { qrCode: { $exists: false } },
        { qrCode: null },
        { emailSent: { $ne: true } }
      ]
    });
    
    console.log(`📊 Found ${paidTickets.length} tickets to process`);
    
    // Group tickets by email/bulkOrderId
    const ticketsByGroup = {};
    paidTickets.forEach(ticket => {
      const key = ticket.bulkOrderId || ticket.email;
      if (!ticketsByGroup[key]) {
        ticketsByGroup[key] = [];
      }
      ticketsByGroup[key].push(ticket);
    });
    
    console.log(`📧 Processing ${Object.keys(ticketsByGroup).length} email groups`);
    
    // Process each group
    for (const [groupKey, tickets] of Object.entries(ticketsByGroup)) {
      try {
        console.log(`\n📨 Processing group: ${groupKey} (${tickets.length} tickets)`);
        
        // Generate QR codes for tickets that don't have them
        for (const ticket of tickets) {
          if (!ticket.qrCode) {
            console.log(`  Generating QR for ticket ${ticket.ticketId}...`);
            const qrResult = await generateQRCode(ticket);
            ticket.qrCode = qrResult.qrCode;
            ticket.qrCodeData = qrResult.qrData;
            await ticket.save();
          }
        }
        
        // Send email with all tickets in this group
        const primaryTicket = tickets[0];
        console.log(`  Sending email to ${primaryTicket.email}...`);
        
        const emailSent = await sendTicketEmail(tickets, primaryTicket);
        
        if (emailSent) {
          // Mark all tickets as emailed
          for (const ticket of tickets) {
            ticket.emailSent = true;
            ticket.emailSentAt = new Date();
            await ticket.save();
          }
          console.log(`  ✅ Email sent successfully to ${primaryTicket.email}`);
        } else {
          console.log(`  ❌ Failed to send email to ${primaryTicket.email}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (groupError) {
        console.error(`❌ Error processing group ${groupKey}:`, groupError.message);
      }
    }
    
    console.log('\n✅ All tickets processed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
resendTicketsToPaidCustomers();