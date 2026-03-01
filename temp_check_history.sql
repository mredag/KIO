SELECT 
  instagram_id,
  direction,
  substr(message_text, 1, 50) as message,
  created_at
FROM instagram_interactions 
WHERE instagram_id = '3279145565594935'
ORDER BY created_at DESC 
LIMIT 10;
