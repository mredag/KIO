SELECT 
  id,
  instagram_id,
  direction,
  substr(message_text, 1, 100) as message_preview,
  model_used,
  model_tier,
  created_at,
  json_extract(pipeline_trace, '$.directResponse.used') as direct_used,
  json_extract(pipeline_trace, '$.policyValidation.status') as policy_status
FROM instagram_interactions 
WHERE created_at >= datetime('now', '-2 hours')
ORDER BY created_at DESC 
LIMIT 20;
