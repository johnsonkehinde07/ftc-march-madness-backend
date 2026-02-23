// Add this at the VERY TOP of the file
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Force Node.js to use IPv4 instead of IPv6

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Updated to handle multiple tickets with Gmail-friendly QR display
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
    const subtotal = tickets.reduce((sum, t) => sum + (t.price || 8700), 0);
    const total = subtotal + 300; // Add fee
    
    // Generate HTML for all tickets with Gmail-friendly formatting
    let ticketsHtml = '';
    tickets.forEach((ticket, index) => {
      // Safely get values with defaults
      const ticketId = ticket.ticketId || 'N/A';
      const ticketType = ticket.ticketType || 'RUNNER UP';
      const ticketPrice = ticket.price || 8700;
      const qrCode = ticket.qrCode || '';
      
      ticketsHtml += `
        <div style="margin-bottom: 40px; padding: 20px; border: 2px solid #8B1E1E; background: rgba(139,30,30,0.1); font-family: Arial, Helvetica, sans-serif;">
          <h3 style="color: #C69C6D; margin: 0 0 15px 0; font-size: 1.3rem;">🎟️ Ticket ${index + 1} of ${tickets.length}</h3>
          
          <!-- Ticket details in table format for better email client compatibility -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <tr>
              <td style="padding: 8px 5px; color: #C69C6D; width: 100px; font-weight: bold;">TICKET ID:</td>
              <td style="padding: 8px 5px; color: #F5E6D3; font-family: monospace; font-size: 14px;">${ticketId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 5px; color: #C69C6D; font-weight: bold;">TYPE:</td>
              <td style="padding: 8px 5px; color: #F5E6D3;">${ticketType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 5px; color: #C69C6D; font-weight: bold;">PRICE:</td>
              <td style="padding: 8px 5px; color: #F5E6D3;">₦${ticketPrice.toLocaleString()}</td>
            </tr>
          </table>
          
          <!-- QR CODE SECTION - Multiple fallbacks for Gmail -->
          ${qrCode ? `
          <div style="text-align: center; margin: 20px 0; background: #ffffff; padding: 20px; border: 2px solid #C69C6D;">
            <p style="color: #1A1212; margin: 0 0 15px 0; font-weight: bold; font-size: 16px;">🔳 SCAN THIS QR CODE AT ENTRY</p>
            
            <!-- Method 1: Standard image (works in most clients) -->
            <img src="${qrCode}" alt="QR Code for ticket ${ticketId}" width="200" height="200" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border: 3px solid #C69C6D;">
            
            <!-- Method 2: Text fallback for Gmail (always works) -->
            <div style="margin-top: 20px; padding: 15px; background: #1A1212; border: 2px solid #8B1E1E;">
              <p style="color: #C69C6D; margin: 0 0 10px 0; font-weight: bold; font-size: 14px;">⬇️ TICKET ID (USE IF QR FAILS) ⬇️</p>
              <p style="color: #F5E6D3; font-size: 18px; font-family: monospace; background: #333; padding: 10px; letter-spacing: 2px; border-radius: 4px;">
                ${ticketId}
              </p>
              <p style="color: #DCC7B0; font-size: 12px; margin: 10px 0 0 0;">
                Present this ID at the entrance if QR code doesn't scan
              </p>
            </div>
            
            <!-- Method 3: Direct link to view online -->
            <div style="margin-top: 15px;">
              <a href="https://ftc-march-madness-frontend.onrender.com/ticket.html?id=${ticketId}" 
                 style="background: #8B1E1E; color: white; padding: 12px 25px; text-decoration: none; border: 2px solid #C69C6D; display: inline-block; font-weight: bold; font-size: 14px;">
                 🔗 VIEW TICKET ONLINE
              </a>
            </div>
          </div>
          ` : '<p style="color: #8B1E1E; text-align: center; padding: 20px;">QR Code pending - please contact support</p>'}
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
            font-family: Arial, Helvetica, sans-serif; 
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
            font-size: 14px; 
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
          }
          .buyer-info p { 
            margin: 8px 0; 
            color: #F5E6D3; 
            font-size: 14px; 
          }
          .buyer-info strong { 
            color: #C69C6D; 
            width: 80px; 
            display: inline-block; 
          }
          .summary { 
            background: rgba(198,156,109,0.1); 
            border: 2px solid #C69C6D; 
            padding: 15px; 
            margin-bottom: 30px; 
            text-align: center; 
          }
          .summary p { 
            margin: 8px 0; 
            color: #F5E6D3; 
            font-size: 16px; 
          }
          .summary .total { 
            font-size: 24px; 
            color: #C69C6D; 
            font-weight: bold; 
          }
          .footer { 
            border-top: 2px solid #8B1E1E; 
            padding-top: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #DCC7B0; 
          }
          .online-link {
            display: inline-block;
            background: #8B1E1E;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border: 2px solid #C69C6D;
            font-weight: bold;
            font-size: 16px;
            margin: 10px 0;
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
            <p><strong>NAME:</strong> ${name}</p>
            <p><strong>EMAIL:</strong> ${email}</p>
            <p><strong>DATE:</strong> MARCH 7, 2026</p>
            <p><strong>LOCATION:</strong> KODO BEACH HOUSE</p>
          </div>
          
          <div class="summary">
            <p><strong style="color: #C69C6D;">TOTAL TICKETS:</strong> ${tickets.length}</p>
            <p><strong style="color: #C69C6D;">SUBTOTAL:</strong> ₦${subtotal.toLocaleString()}</p>
            <p><strong style="color: #C69C6D;">FEE:</strong> ₦300</p>
            <p class="total">TOTAL PAID: ₦${total.toLocaleString()}</p>
          </div>
          
          <h3 style="color: #C69C6D; text-align: center; margin: 30px 0 20px; font-size: 20px;">YOUR TICKETS</h3>
          
          ${ticketsHtml}
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #F5E6D3; margin-bottom: 15px;">Having trouble viewing your tickets?</p>
            <a href="https://ftc-march-madness-frontend.onrender.com/tickets?email=${encodeURIComponent(email)}" class="online-link">
              📱 VIEW ALL TICKETS ONLINE
            </a>
          </div>
          
          <div class="footer">
            <p>These tickets are unique and non-transferable.</p>
            <p>Present QR code or Ticket ID at the entrance.</p>
            <p>If you have any issues, contact support@ftcmarch.com</p>
            <p style="margin-top: 15px;">© 2026 FTC · MARCH MADNESS · ALL RIGHTS RESERVED</p>
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