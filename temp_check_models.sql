SELECT 
  json_extract(actions, '$.directResponse.tiers.light.modelId') as light_model,
  json_extract(actions, '$.directResponse.tiers.standard.modelId') as standard_model,
  json_extract(actions, '$.directResponse.tiers.advanced.modelId') as advanced_model,
  json_extract(actions, '$.policy.validationModel') as policy_model,
  json_extract(actions, '$.directPrompt.systemTemplate') as system_prompt_preview
FROM mc_policies 
WHERE id='dm_pipeline_config';
