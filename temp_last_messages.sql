SELECT created_at, direction, substr(message_text,1,80) as msg, model_used, model_tier 
FROM instagram_interactions 
ORDER BY created_at DESC 
LIMIT 10;
