const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendTicketEmail = async (ticket, qrCode) => {
  try {
    const mailOptions = {
      from: `"FTC MARCH MADNESS" <${process.env.EMAIL_USER}>`,
      to: ticket.email,
      subject: '🎫 YOUR TICKET - FTC MARCH MADNESS',
      html: `
        <div style="font-family: Inter; max-width: 600px; margin: 0 auto; background: #1A1212; color: #F5E6D3; padding: 40px; border: 3px solid #8B1E1E;">
          <h1 style="color: #C69C6D; text-align: center;">FTC MARCH MADNESS</h1>
          <div style="background: rgba(139,30,30,0.2); padding: 20px; margin: 20px 0;">
            <p><strong>TICKET ID:</strong> ${ticket.ticketId}</p>
            <p><strong>NAME:</strong> ${ticket.name}</p>
            <p><strong>DATE:</strong> MARCH 7, 2026</p>
            <p><strong>LOCATION:</strong> BEACH HOUSE</p>
          </div>
          <div style="text-align: center;">
            <p>SCAN THIS QR CODE AT ENTRY</p>
            <img src="${qrCode}" style="width: 250px; border: 3px solid #C69C6D;">
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${ticket.email}`);
    return true;
  } catch (error) {
    console.error('Email Error:', error);
    return false;
  }
};

module.exports = sendTicketEmail;