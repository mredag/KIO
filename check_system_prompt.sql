SELECT json_extract(conditions, '$.directPrompt.systemTemplate') as system_prompt 
FROM mc_policies 
WHERE id='dm_pipeline_config' 
LIMIT 1;
