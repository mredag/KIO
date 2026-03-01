SELECT 
  json_extract(actions, '$.directResponse.tiers.light.modelId') as light_model,
  json_extract(actions, '$.directResponse.tiers.standard.modelId') as standard_model,
  json_extract(actions, '$.directResponse.tiers.advanced.modelId') as advanced_model
FROM mc_policies WHERE id='dm_pipeline_config';
