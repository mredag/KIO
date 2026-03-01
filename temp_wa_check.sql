-- Check for "mutlu sonlu" related messages
SELECT 
  datetime(created_at, 'localtime') as time,
  direction,
  substr(message_text, 1, 100) as message,
  model_used,
  model_tier
FROM whatsapp_interactions 
WHERE message_text LIKE '%mutlu%' 
ORDER BY created_at DESC 
LIMIT 20;
