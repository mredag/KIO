-- Check 1: System prompt has context instructions
SELECT 
  CASE 
    WHEN json_extract(actions, '$.directPrompt.systemTemplate') LIKE '%KONUŞMA GEÇMİŞİ%' 
    THEN '✅ System prompt has context instructions'
    ELSE '❌ System prompt missing context instructions'
  END as check1
FROM mc_policies WHERE id='dm_pipeline_config';

-- Check 2: Models are Claude Sonnet 3.5
SELECT 
  CASE 
    WHEN json_extract(actions, '$.directResponse.tiers.standard.modelId') = 'anthropic/claude-3.5-sonnet'
    THEN '✅ Standard tier uses Claude Sonnet 3.5'
    ELSE '❌ Standard tier NOT using Claude Sonnet 3.5'
  END as check2
FROM mc_policies WHERE id='dm_pipeline_config';

-- Check 3: No dm_customer_sessions table (Jarvis's plan not implemented)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ No dm_customer_sessions table (clean state)'
    ELSE '❌ dm_customer_sessions table exists (Jarvis plan mixed in)'
  END as check3
FROM sqlite_master 
WHERE type='table' AND name='dm_customer_sessions';

-- Check 4: instagram_interactions table exists (our current system)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 
    THEN '✅ instagram_interactions table exists (current system)'
    ELSE '❌ instagram_interactions table missing'
  END as check4
FROM sqlite_master 
WHERE type='table' AND name='instagram_interactions';
