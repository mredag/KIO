SELECT id, type, json_extract(conditions, '$.directPrompt') as direct_prompt_section
FROM mc_policies 
WHERE id='dm_pipeline_config';
