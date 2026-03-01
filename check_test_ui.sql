SELECT 
  id, 
  instagram_id, 
  direction, 
  substr(message_text, 1, 30) as msg,
  json_extract(pipeline_trace, '$.sexualIntent.action') as sexual_action,
  json_extract(pipeline_trace, '$.sexualIntent.confidence') as sexual_conf,
  created_at
FROM instagram_interactions 
WHERE instagram_id='test_ui_001' 
ORDER BY created_at DESC 
LIMIT 2;
