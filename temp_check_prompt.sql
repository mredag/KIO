SELECT substr(json_extract(actions, '$.directPrompt.systemTemplate'), 1, 200) as prompt_start
FROM mc_policies 
WHERE id='dm_pipeline_config';
