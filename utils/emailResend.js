// Add this at the VERY TOP of the file
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Force Node.js to use IPv4 instead of IPv6

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Updated to handle multiple tickets with proper error handling
const sendTicketEmailResend = async (tickets, primaryTicket) => {
  try {
    // Handle case where a single ticket is passed instead of array
    if (!Array.isArray(tickets)) {
      tickets = [tickets];
      primaryTicket = primaryTicket || tickets[0];
    }
    
    // Safely get email and name
    const email = primaryTicket?.email || tickets[0]?.email;
    const name = primaryTicket?.name || tickets[0]?.name || 'Valued Customer';
    
    if (!email) {
      console.error('❌ No email address found for ticket');
      return false;
    }
    
    console.log(`📧 Sending email with ${tickets.length} ticket(s) to ${email}...`);
    
    // Calculate total safely
    const subtotal = tickets.reduce((sum, t) => sum + (t.price || 8000), 0);
    const total = subtotal + 300; // Add fee
    
    // Generate HTML for all tickets
    let ticketsHtml = '';
    tickets.forEach((ticket, index) => {
      // Safely get values with defaults
      const ticketId = ticket.ticketId || 'N/A';
      const ticketType = ticket.ticketType || 'WINNERS FC';
      const ticketPrice = ticket.price || 8000;
      const qrCode = ticket.qrCode || '';
      
      // Extract base64 data for QR code if exists
      const base64Data = qrCode ? qrCode.replace(/^data:image\/png;base64,/, '') : '';
      
      ticketsHtml += `
        <div style="margin-bottom: 30px; padding: 20px; border: 2px solid #8B1E1E; background: rgba(139,30,30,0.1);">
          <h3 style="color: #C69C6D; margin-top: 0; margin-bottom: 15px; font-size: 1.3rem;">🎟️ Ticket ${index + 1} of ${tickets.length}</h3>
          <p style="margin: 8px 0;"><strong style="color: #C69C6D;">TICKET ID:</strong> <span style="color: #F5E6D3;">${ticketId}</span></p>
          <p style="margin: 8px 0;"><strong style="color: #C69C6D;">TYPE:</strong> <span style="color: #F5E6D3;">${ticketType}</span></p>
          <p style="margin: 8px 0;"><strong style="color: #C69C6D;">PRICE:</strong> <span style="color: #F5E6D3;">₦${ticketPrice.toLocaleString()}</span></p>
          ${qrCode ? `
          <div style="text-align: center; margin-top: 15px; background: #ffffff; padding: 15px; border: 1px solid #C69C6D;">
            <!-- QR Code as inline image with fallback text -->
            <img src="${qrCode}" alt="QR Code for ticket ${ticketId}" style="width: 200px; height: 200px; border: 3px solid #C69C6D; padding: 5px; background: white; display: block; margin: 0 auto;">
            <p style="color: #1A1212; margin-top: 10px; font-size: 0.9rem; background: #F5E6D3; padding: 8px;">
              <strong>Ticket ID:</strong> ${ticketId}<br>
              <span style="color: #8B1E1E;">Present this ID at the entrance if QR code doesn't load</span>
            </p>
          </div>
          ` : '<p style="color: #8B1E1E; text-align: center;">QR Code pending</p>'}
        </div>
      `;
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Inter', Arial, sans-serif;
            background: #1A1212;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #1A1212;
            border: 3px solid #8B1E1E;
            padding: 30px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #8B1E1E;
            padding-bottom: 20px;
          }
          .ftc {
            color: #C69C6D;
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 4px;
            margin: 0;
          }
          .presents {
            color: #F5E6D3;
            font-style: italic;
            margin: 5px 0;
          }
          .event-name {
            color: #F5E6D3;
            font-size: 42px;
            font-weight: 900;
            text-transform: uppercase;
            text-shadow: 3px 3px 0 #8B1E1E;
            margin: 10px 0;
          }
          .buyer-info {
            background: rgba(139,30,30,0.2);
            border: 2px solid #8B1E1E;
            padding: 15px;
            margin-bottom: 30px;
            text-align: center;
          }
          .buyer-info p {
            margin: 5px 0;
            color: #F5E6D3;
          }
          .summary {
            background: rgba(198,156,109,0.1);
            border: 2px solid #C69C6D;
            padding: 15px;
            margin-bottom: 30px;
            text-align: center;
          }
          .summary p {
            margin: 5px 0;
            color: #F5E6D3;
            font-size: 1.1rem;
          }
          .footer {
            border-top: 2px solid #8B1E1E;
            padding-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #DCC7B0;
          }
          .fallback-link {
            display: inline-block;
            background: #8B1E1E;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border: 2px solid #C69C6D;
            margin-top: 15px;
            font-weight: bold;
          }
          .fallback-link:hover {
            background: #C69C6D;
            color: #1A1212;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="ftc">FTC</h1>
            <p class="presents">presents</p>
            <h2 class="event-name">MARCH MADNESS</h2>
          </div>
          
          <div class="buyer-info">
            <p><strong style="color: #C69C6D;">NAME:</strong> ${name}</p>
            <p><strong style="color: #C69C6D;">EMAIL:</strong> ${email}</p>
            <p><strong style="color: #C69C6D;">DATE:</strong> MARCH 7, 2026</p>
            <p><strong style="color: #C69C6D;">LOCATION:</strong> KODO BEACH HOUSE</p>
          </div>
          
          <div class="summary">
            <p><strong style="color: #C69C6D;">TOTAL TICKETS:</strong> ${tickets.length}</p>
            <p><strong style="color: #C69C6D;">SUBTOTAL:</strong> ₦${subtotal.toLocaleString()}</p>
            <p><strong style="color: #C69C6D;">FEE:</strong> ₦300</p>
            <p><strong style="color: #C69C6D; font-size: 1.3rem;">TOTAL PAID:</strong> <span style="color: #C69C6D; font-size: 1.3rem;">₦${total.toLocaleString()}</span></p>
          </div>
          
          <h3 style="color: #C69C6D; text-align: center; margin: 30px 0 20px;">YOUR TICKETS</h3>
          
          ${ticketsHtml}
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #F5E6D3;">Having trouble viewing the QR codes?</p>
            <a href="https://ftcmarch.com.ng/tickets?email=${encodeURIComponent(email)}" class="fallback-link">
              VIEW ALL YOUR TICKETS ONLINE
            </a>
          </div>
          
          <div class="footer">
            <p>These tickets are unique and non-transferable.</p>
            <p>Present the QR codes at the entrance for scanning.</p>
            <p>If QR codes don't load, provide your Ticket ID at the door.</p>
            <p>© 2026 FTC · MARCH MADNESS · ALL RIGHTS RESERVED</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const { data, error } = await resend.emails.send({
      from: 'FTC March Madness <noreply@ftcmarch.com.ng>',
      to: [email],
      subject: `🎫 YOUR ${tickets.length} TICKET(S) - FTC MARCH MADNESS`,
      html: html
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      return false;
    }

    console.log(`✅ Email sent via Resend to ${email}. ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error('❌ Resend Exception:', error);
    return false;
  }
};

module.exports = sendTicketEmailResend;