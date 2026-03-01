SELECT 
  id, 
  instagram_id, 
  direction, 
  substr(message_text, 1, 30) as msg,
  created_at
FROM instagram_interactions 
ORDER BY created_at DESC 
LIMIT 5;
