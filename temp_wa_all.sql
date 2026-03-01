-- Check all WhatsApp messages
SELECT 
  COUNT(*) as total_messages,
  MAX(datetime(created_at, 'localtime')) as last_message
FROM whatsapp_interactions;
