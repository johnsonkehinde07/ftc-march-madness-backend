const QRCode = require('qrcode');

const generateQRCode = async (ticketData) => {
  try {
    const qrData = JSON.stringify({
      ticketId: ticketData.ticketId,
      name: ticketData.name,
      email: ticketData.email,
      event: 'FTC MARCH MADNESS',
      date: '2026-03-07'
    });

    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#8B1E1E',
        light: '#F5E6D3'
      }
    });

    return {
      qrCode: qrCodeBase64,
      qrData: qrData
    };
  } catch (error) {
    console.error('QR Generation Error:', error);
    throw error;
  }
};

module.exports = generateQRCode;