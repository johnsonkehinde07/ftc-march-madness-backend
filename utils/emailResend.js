// Add this at the VERY TOP of the file
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Force Node.js to use IPv4 instead of IPv6

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendTicketEmailResend = async (ticket, qrCode) => {
  try {
    console.log(`📧 Attempting to send email via Resend to ${ticket.email}...`);
    
    // First, verify the QR code is valid
    if (!qrCode || !qrCode.startsWith('data:image')) {
      console.error('❌ Invalid QR code format');
      return false;
    }

    // Extract base64 data
    const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
    
    const { data, error } = await resend.emails.send({
      from: 'FTC March Madness <noreply@ftcmarch.com.ng>', // Resend default domain for testing
      to: [ticket.email],
      subject: '🎫 YOUR TICKET - FTC MARCH MADNESS',
      html: `
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
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #1A1212;
              border: 3px solid #8B1E1E;
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
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
            .ticket-info {
              background: rgba(139,30,30,0.2);
              border: 2px solid #8B1E1E;
              padding: 20px;
              margin: 30px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid rgba(198,156,109,0.3);
            }
            .info-label {
              color: #C69C6D;
              font-weight: 600;
            }
            .info-value {
              color: #F5E6D3;
              font-weight: 400;
            }
            .qr-section {
              text-align: center;
              margin: 30px 0;
            }
            .qr-title {
              color: #C69C6D;
              font-weight: bold;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .qr-code {
              width: 250px;
              height: 250px;
              border: 3px solid #C69C6D;
              padding: 10px;
              background: white;
            }
            .footer {
              border-top: 2px solid #8B1E1E;
              padding-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #DCC7B0;
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
            
            <div class="ticket-info">
              <div class="info-row">
                <span class="info-label">TICKET ID:</span>
                <span class="info-value">${ticket.ticketId}</span>
              </div>
              <div class="info-row">
                <span class="info-label">NAME:</span>
                <span class="info-value">${ticket.name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">EMAIL:</span>
                <span class="info-value">${ticket.email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">DATE:</span>
                <span class="info-value">MARCH 7, 2026</span>
              </div>
              <div class="info-row">
                <span class="info-label">LOCATION:</span>
                <span class="info-value">BEACH HOUSE</span>
              </div>
              <div class="info-row">
                <span class="info-label">PRICE:</span>
                <span class="info-value">₦8,000</span>
              </div>
            </div>
            
            <div class="qr-section">
              <div class="qr-title">🎟️ SCAN AT ENTRY</div>
              <img src="${qrCode}" alt="QR Code" class="qr-code">
              <p style="color: #C69C6D; margin-top: 10px;">Present this QR code at the gate</p>
            </div>
            
            <div class="footer">
              <p>This ticket is unique and non-transferable.</p>
              <p>© 2026 FTC · MARCH MADNESS · ALL RIGHTS RESERVED</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `FTC-${ticket.ticketId}-QR.png`,
          content: base64Data,
          encoding: 'base64'
        }
      ]
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      return false;
    }

    console.log(`✅ Email sent via Resend to ${ticket.email}. ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error('❌ Resend Exception:', error);
    return false;
  }
};

module.exports = sendTicketEmailResend;