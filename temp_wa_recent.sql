-- Check all WhatsApp messages in last 24 hours
SELECT 
  datetime(created_at, 'localtime') as time,
  phone,
  direction,
  substr(message_text, 1, 60) as message
FROM whatsapp_interactions 
WHERE created_at >= datetime('now', '-24 hours')
ORDER BY created_at DESC 
LIMIT 30;
