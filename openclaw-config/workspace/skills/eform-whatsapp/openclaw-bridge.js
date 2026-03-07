const WhatsAppHandler = require('./index.js');

/**
 * OpenClaw skill wrapper for WhatsApp customer agent
 * Bridge between OpenClaw and the WhatsApp handler
 */

const whatsapp = new WhatsAppHandler();

/**
 * Process incoming WhatsApp message
 * @param {Object} messageData - WhatsApp webhook payload
 * @param {string} messageData.from - Phone number
 * @param {string} messageData.message - Message text
 * @param {string} messageData.messageId - Unique message ID
 * @param {string} messageData.timestamp - Message timestamp
 * @returns {Promise<Object>} - Response object for OpenClaw
 */
async function processWhatsAppMessage(messageData) {
  try {
    console.log(`Processing WhatsApp message from ${messageData.from}`);
    const text = messageData.message || '';
    const responseText = await whatsapp.handleMessage(text);

    return {
      success: true,
      response: responseText,
      metadata: {
        intent: whatsapp.detectIntent(text),
        language: 'tr',
        source: 'whatsapp',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('WhatsApp skill error:', error);
    return {
      success: false,
      error: error.message,
      response: "Uzgunum, gecici bir hata olustu. Lutfen daha sonra tekrar deneyin veya bizi arayin."
    };
  }
}

/**
 * Batch process multiple messages (for testing)
 */
async function processMultipleMessages(messages) {
  const results = [];
  for (const message of messages) {
    const result = await processWhatsAppMessage(message);
    results.push({ original: message, processed: result });
  }
  return results;
}

function healthCheck() {
  return {
    status: 'ok',
    handler: 'WhatsApp customer agent',
    knowledge: 'KIO API connected',
    language: 'Turkish',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  processMessage: processWhatsAppMessage,
  processBatch: processMultipleMessages,
  health: healthCheck,
  handler: whatsapp
};

if (require.main === module) {
  const testMessages = [
    { from: "+90532xxx1", message: "Merhaba aylik uyelik fiyati ne kadar?" },
    { from: "+90532xxx2", message: "Calisma saatleriniz nedir?" },
    { from: "+90532xxx3", message: "Yuzme hizmeti var mi?" },
    { from: "+90532xxx4", message: "Randevu almak istiyorum" }
  ];

  (async () => {
    console.log("Eform WhatsApp Agent Test\n");
    console.log("Health Check:", JSON.stringify(healthCheck(), null, 2));
    console.log("\n" + "=".repeat(50) + "\n");

    const results = await processMultipleMessages(testMessages);
    results.forEach((result, index) => {
      console.log(`Test ${index + 1}: ${result.original.message}`);
      console.log("Response:", result.processed.response);
      console.log("Intent:", result.processed.metadata?.intent);
      console.log("-".repeat(50));
    });
  })().catch(console.error);
} else {
  console.log("Eform WhatsApp Agent loaded - ready for OpenClaw integration");
}
