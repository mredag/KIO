/**
 * WhatsApp Customer Agent for Eform Spor Merkezi
 * Handles Turkish WhatsApp messages using KIO knowledge base
 */

const KIO_BASE_URL = process.env.KIO_API_URL || 'http://localhost:3001';
const KIO_AUTH = `Bearer ${process.env.KIO_API_KEY || process.env.N8N_API_KEY || '<N8N_API_KEY>'}`;

class WhatsAppHandler {
  constructor() {
    this.intentPatterns = {
      pricing: /ucret|fiyat|kac tl|ne kadar|tutar|uyelik/gi,
      hours: /saat|calisma saatleri|kacta acilir|kacta kapanir|acik|kapali/gi,
      services: /servis|hizmet|ne yapilir|ne var|aktivite|masaj|spa|fitness/gi,
      booking: /randevu|rezervasyon|seans|donem|program/gi,
      location: /nerede|konum|adres|neresi|yol tarifi/gi,
      contact: /telefon|whatsapp|iletisim|ulas/gi
    };
  }

  async handleMessage(message) {
    if (!message || !message.trim()) {
      return "Merhaba! Size nasil yardimci olabilirim?";
    }

    try {
      const intent = this.detectIntent(message);
      const response = await this.generateResponse(message, intent);
      return response;
    } catch (error) {
      console.error('WhatsApp handler error:', error);
      return "Uzgunum, su anda bu bilgiye erisemiyorum. Daha detayli bilgi icin lutfen bizi arayin.";
    }
  }

  detectIntent(message) {
    const normalized = message.toLowerCase()
      .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i')
      .replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ç/g, 'c');

    const intentScores = {};
    Object.entries(this.intentPatterns).forEach(([intent, pattern]) => {
      const matches = normalized.match(pattern);
      intentScores[intent] = matches ? matches.length : 0;
    });

    let bestIntent = 'general';
    let maxScore = 0;
    Object.entries(intentScores).forEach(([intent, score]) => {
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    });

    return bestIntent;
  }

  async generateResponse(message, intent) {
    try {
      const knowledge = await this.fetchKnowledge(message, intent);

      if (!knowledge || !knowledge.length) {
        return this.handleMissingInfo(intent);
      }

      const responseTemplate = this.getResponseTemplate(intent);
      const context = knowledge[0];
      return this.formatResponse(responseTemplate, context);
    } catch (error) {
      console.error('Response generation error:', error);
      return this.handleMissingInfo(intent);
    }
  }

  async fetchKnowledge(query, intent) {
    try {
      const url = `${KIO_BASE_URL}/api/integrations/knowledge/context?intent=${encodeURIComponent(intent)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': KIO_AUTH,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`KIO API error: ${response.status}`);
      }

      const data = await response.json();
      return this.filterKnowledge(data, query, intent);
    } catch (error) {
      console.error('Knowledge fetch error:', error);
      return null;
    }
  }

  filterKnowledge(knowledge, query, intent) {
    if (!knowledge || !Array.isArray(knowledge)) return [];
    if (knowledge.length === 0) return [];

    const keywords = query.toLowerCase()
      .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i')
      .replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .split(/\s+/);

    return knowledge.filter(item => {
      const text = JSON.stringify(item).toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    }).slice(0, 3);
  }

  getResponseTemplate(intent) {
    const templates = {
      pricing: {
        greeting: "Merhaba! Eform Spor Merkezi uyelik ucretleri hakkinda bilgi:",
        detail: "{content}",
        action: "Daha detayli bilgi icin lutfen bizi arayin veya ofise gelin."
      },
      hours: {
        greeting: "Merhaba! Eform Spor Merkezi calisma saatleri:",
        detail: "{content}",
        action: "Her gun antrenman zamaninizi planlama icin yardimci oluruz."
      },
      services: {
        greeting: "Merhaba! Eform Spor Merkezi'nde sunulan hizmetler:",
        detail: "{content}",
        action: "Size uygun programi olusturmak icin goruselim."
      },
      booking: {
        greeting: "Merhaba! Randevu icin buradayim:",
        detail: "{content}",
        action: "Size en uygun saati rezerve etmek icin lutfen bizi arayin."
      },
      location: {
        greeting: "Merhaba! Eform Spor Merkezi konum bilgisi:",
        detail: "{content}",
        action: "Bizi kolayca bulabilirsiniz!"
      },
      contact: {
        greeting: "Merhaba! Iletisim bilgilerimiz:",
        detail: "{content}",
        action: "Size yardimci olmaktan mutluluk duyariz."
      },
      general: {
        greeting: "Merhaba! Ben Eform Spor Merkezi dijital asistaniyim.",
        detail: "{content}",
        action: "Herhangi bir konuda size yardimci olmaktan mutluluk duyarim."
      }
    };
    return templates[intent] || templates.general;
  }

  formatResponse(template, context) {
    if (!context) {
      return this.handleMissingInfo('general');
    }

    const responseParts = [];
    if (template.greeting) responseParts.push(template.greeting);

    if (context.content) {
      const detail = template.detail.replace('{content}', context.content);
      responseParts.push(detail);
    }

    if (template.action) responseParts.push(template.action);

    // Max 4 paragraphs
    return responseParts.slice(0, 4).join('\n\n');
  }

  handleMissingInfo(intent) {
    const fallbacks = {
      pricing: "Ucretlendirme konusunda guncel bilgi icin lutfen bizi arayin veya ofise geliniz.",
      hours: "Guncel saatlerimiz hakkinda bilgi icin lutfen bizi arayiniz.",
      services: "Detayli hizmet listesi icin lutfen bizi arayin veya size uygun programi olusturalim.",
      booking: "Randevu ve program bilgisi icin lutfen bizi arayin.",
      location: "Konum bilgisi icin lutfen bizi arayin.",
      contact: "Iletisim bilgileri icin lutfen web sitemizi ziyaret edin.",
      general: "Bu konuda detayli bilgi icin lutfen bizi arayin."
    };
    return `Merhaba! ${fallbacks[intent] || fallbacks.general}`;
  }
}

module.exports = WhatsAppHandler;

if (require.main === module) {
  const handler = new WhatsAppHandler();
  const testMessage = process.argv[2] || "Merhaba, uyelik fiyatlarini ogrenmek istiyorum";

  handler.handleMessage(testMessage)
    .then(response => {
      console.log('WhatsApp Response:');
      console.log(response);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}
