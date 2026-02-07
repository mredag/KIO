# Fix: "Mix Masaj" False Positive

## Problem
User asks "mix nasaj ne oluyor?" (what is mix massage?) and AI incorrectly rejects it as inappropriate content.

**Root Cause:** AI Safety Check doesn't know that "MİX Masaj" is a legitimate service.

## Evidence
From knowledge base:
```
massage_mix|MİX Masaj : En kapsamlı masajımız! 7 farklı masaj tekniğini bir arada sunar...
special_massage|✨ Özel Masaj Programları: - MİX 70dk: 2000₺
```

## Solution Strategy

### Option 1: Add Explicit ALLOW Patterns (RECOMMENDED)
Update AI Safety Check prompt to explicitly allow service names:

```javascript
ALLOW (izin ver) - Asagidaki NORMAL sorular KESINLIKLE ALLOW:
- Fiyat sorulari: masaj fiyati, ucret, ne kadar, kac para, 60 dakika masaj ucret, gunluk giris
- Hizmet sorulari: kese kopuk, hamam, sauna, aromaterapi, sicak tas, terapist bilgi, MIX masaj, medikal masaj
- Masaj turleri: klasik masaj, sicak tas masaj, MIX masaj, medikal masaj, kese kopuk
```

### Option 2: Check Knowledge Base Before Safety Gate
Move AI Safety Check AFTER Enrich Context so it has access to knowledge base:

**Current Flow:**
```
Enrich Context → AI Safety Check → AI Agent
```

**Proposed Flow:**
```
Enrich Context → [Check if service name] → AI Safety Check → AI Agent
```

Add a pre-filter node:
```javascript
const text = $json.text.toLowerCase();
const knowledgeServices = ['mix masaj', 'sicak tas', 'medikal masaj', 'kese kopuk', 'klasik masaj'];

// If message mentions a known service, skip safety check
for (const service of knowledgeServices) {
  if (text.includes(service)) {
    return [{ json: { ...$ json, safetyDecision: 'ALLOW', safetyReason: 'known_service' } }];
  }
}

// Otherwise, proceed to AI Safety Check
return [{ json: $json }];
```

### Option 3: Improve AI Safety Prompt (QUICK FIX)
Add more context to the safety prompt:

```javascript
'Sen bir guvenlik filtresisin. Mesajlari analiz et ve uygun olup olmadigini belirle.

ONEMLI: Bu bir SPA ve SPOR merkezidir. Asagidaki MEŞRU hizmetler var:
- MIX masaj (7 farkli teknik)
- Sicak tas masaj
- Medikal masaj
- Kese kopuk
- Klasik masaj
- Hamam, sauna, buhar odasi
- Fitness, pilates, yuzme

REJECT (reddet) - SADECE asagidaki durumlarda:
- Acik cinsel icerik: "mutlu son", "happy ending", "mutlu", "sonu guzel", ...
- ASLA meşru hizmet isimlerini reddetme!

ALLOW (izin ver) - Asagidaki NORMAL sorular KESINLIKLE ALLOW:
- Fiyat sorulari: masaj fiyati, ucret, ne kadar, kac para, 60 dakika masaj ucret, gunluk giris
- Hizmet sorulari: kese kopuk, hamam, sauna, aromaterapi, sicak tas, terapist bilgi, MIX masaj, medikal masaj
- Masaj turleri: klasik masaj, sicak tas masaj, MIX masaj, medikal masaj, kese kopuk
```

## Recommended Implementation

**Use Option 3 (Quick Fix) + Option 1 (Explicit ALLOW)**

1. Update AI Safety Check prompt to include service names
2. Add explicit ALLOW patterns for all legitimate services
3. Test with "mix masaj" query

## Testing

After fix, test these messages:
- "mix nasaj ne oluyor" → Should ALLOW
- "mix masaj fiyati" → Should ALLOW
- "sicak tas masaj var mi" → Should ALLOW
- "medikal masaj nedir" → Should ALLOW
- "mutlu son var mi" → Should REJECT (still block inappropriate)

## Files to Update

1. `n8n-workflows/workflows-v2/instagram-dual-ai-suspicious-v1.json`
   - Node: "AI Safety Check" (id: ai-safety-check)
   - Update: `jsonBody` → `messages[0].content` (system prompt)

2. `.kiro/steering/ULTIMATE_GUIDE.md`
   - Add to "Common Issues" section
   - Document the fix pattern

## Implementation Code

```json
{
  "parameters": {
    "jsonBody": "={{ JSON.stringify({ model: 'openai/gpt-4o', messages: [{ role: 'system', content: 'Sen bir guvenlik filtresisin. Mesajlari analiz et ve uygun olup olmadigini belirle.\\n\\nONEMLI: Bu bir SPA ve SPOR merkezidir. Asagidaki MEŞRU hizmetler var:\\n- MIX masaj (7 farkli teknik, premium hizmet)\\n- Sicak tas masaj\\n- Medikal masaj\\n- Kese kopuk (geleneksel hamam hizmeti)\\n- Klasik masaj\\n- Hamam, sauna, buhar odasi\\n- Fitness, pilates, yuzme\\n\\nREJECT (reddet) - SADECE asagidaki durumlarda:\\n- Acik cinsel icerik: \"mutlu son\", \"happy ending\", \"mutlu\", \"sonu guzel\", \"sonu keyifli\", \"ekstra servis\", \"ozel masaj\", \"gizli hizmet\", \"VIP masaj\", \"full servis\", \"escort\", \"romantik masaj\", \"sevgili masaji\", \"partner masaji\"\\n- Cinsel ima: \"masaj sonrasi ne olur\", \"odada ne olur\", \"gece masaji\", \"keyifli masaj\"\\n- Personel bilgisi istekleri: \"terapist telefonu\", \"calisanin numarasi\", \"masajci kiz\"\\n- Taciz, tehdit, kufur\\n\\nALLOW (izin ver) - Asagidaki NORMAL sorular KESINLIKLE ALLOW:\\n- Fiyat sorulari: masaj fiyati, ucret, ne kadar, kac para, 60 dakika masaj ucret, gunluk giris\\n- Hizmet sorulari: kese kopuk, hamam, sauna, aromaterapi, sicak tas, terapist bilgi, MIX masaj, medikal masaj\\n- Masaj turleri: klasik masaj, sicak tas masaj, MIX masaj, medikal masaj, kese kopuk\\n- Saat sorulari: saat kacta, acik mi, kapali mi, yuzme saati\\n- Adres sorulari: nerede, adres, yer, konum\\n- Randevu talepleri\\n- Uyelik sorulari: fitness, pilates, gym, aile uyeligi\\n- Cocuk kurslari: yuzme, jimnastik, cocuk girebilir mi\\n- Genel sorular: merhaba, tesekkur, dahil mi, var mi, hakkinda\\n- Kisa takip sorulari: \"yer\", \"dahil mi\", \"var mi\", \"hakkinda bilgi\"\\n\\nKRITIK: \"ucret\", \"fiyat\", \"ne kadar\" gibi kelimeler NORMAL fiyat sorularidir - ALLOW!\\nKRITIK: \"MIX masaj\", \"sicak tas\", \"medikal masaj\" MEŞRU hizmetlerdir - ALLOW!\\n\\nSadece \"ALLOW\" veya \"REJECT\" yaz.' }, { role: 'user', content: $json.text }], temperature: 0.05, max_tokens: 10 }) }}"
  }
}
```

## Prevention Strategy

To prevent similar issues in the future:

1. **Maintain Service List:** Keep a list of all service names in the safety prompt
2. **Update on New Services:** When adding new services to knowledge base, update safety prompt
3. **Test New Services:** Always test new service names through the workflow
4. **Monitor False Positives:** Check suspicious user logs for legitimate queries being blocked

## Related Issues

This fix also addresses potential false positives for:
- "Sıcak taş masaj" (hot stone massage)
- "Medikal masaj" (medical massage)
- "Kese köpük" (traditional Turkish bath service)
- Any other legitimate service names

---

**Status:** Ready for implementation  
**Priority:** HIGH (affects customer experience)  
**Estimated Time:** 15 minutes  
**Testing Required:** Yes (run test suite after deployment)
