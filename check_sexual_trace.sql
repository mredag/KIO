SELECT 
  id, 
  instagram_id, 
  direction, 
  message_text,
  json_extract(pipeline_trace, '$.sexualIntent.action') as sexual_action,
  json_extract(pipeline_trace, '$.sexualIntent.confidence') as sexual_confidence
FROM instagram_interactions 
WHERE instagram_id='test_sexual_001' 
ORDER BY created_at DESC 
LIMIT 1;
