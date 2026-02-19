const QRCode = require('qrcode');

const generateQRCode = async (ticketData) => {
  try {
    console.log(`🔄 Generating QR code for ticket: ${ticketData.ticketId}`);
    
    // Create QR code data
    const qrData = JSON.stringify({
      ticketId: ticketData.ticketId,
      name: ticketData.name,
      email: ticketData.email,
      event: 'FTC MARCH MADNESS',
      date: '2026-03-07',
      type: ticketData.ticketType || 'WINNERS FC'
    });

    // Generate QR code as base64
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#8B1E1E',  // FTC red
        light: '#F5E6D3'   // Cream background
      }
    });

    console.log(`✅ QR code generated for ${ticketData.ticketId}`);
    
    return {
      qrCode: qrCodeBase64,
      qrData: qrData
    };
  } catch (error) {
    console.error('❌ QR Generation Error:', error);
    throw error;
  }
};

module.exports = generateQRCode;