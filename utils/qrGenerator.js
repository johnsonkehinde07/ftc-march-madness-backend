const QRCode = require('qrcode');

const generateQRCode = async (ticketData) => {
  try {
    console.log(`🔄 Generating QR code for ticket: ${ticketData.ticketId}`);
    
    // Create QR code data with all necessary info
    const qrPayload = {
      ticketId: ticketData.ticketId || 'N/A',
      name: ticketData.name || 'Valued Customer',
      email: ticketData.email || 'no-email@provided.com',
      event: 'FTC MARCH MADNESS',
      date: '2026-03-07',
      type: ticketData.ticketType || 'WINNERS FC',
      issuedAt: new Date().toISOString()
    };

    const qrData = JSON.stringify(qrPayload);
    console.log(`📦 QR Payload:`, qrPayload);

    // Generate QR code as base64 with custom colors
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#8B1E1E', // FTC primary red
        light: '#F5E6D3'  // Off-white background
      }
    });

    console.log(`✅ QR code generated successfully for ${ticketData.ticketId}`);
    
    return {
      qrCode: qrCodeBase64,
      qrData: qrData,
      qrPayload: qrPayload
    };

  } catch (error) {
    console.error('❌ QR Generation Error:', error);
    
    // Return a fallback empty QR rather than crashing
    return {
      qrCode: null,
      qrData: null,
      error: error.message
    };
  }
};

module.exports = generateQRCode;