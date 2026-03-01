SELECT COUNT(*) as recent_count 
FROM instagram_interactions 
WHERE created_at >= datetime('now', '-1 hour');

SELECT 
  instagram_id,
  direction,
  substr(message_text, 1, 60) as message,
  created_at
FROM instagram_interactions 
WHERE created_at >= datetime('now', '-2 hours')
ORDER BY created_at DESC 
LIMIT 20;
