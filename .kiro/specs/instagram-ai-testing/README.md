# Instagram AI Workflow - Comprehensive Test Suite

## Overview

This test suite validates the Instagram AI workflow against all knowledge base content. It covers 12 categories with 70+ test cases.

## Test Categories

1. **FAQ Tests (7)** - All S.S.S. questions
2. **Pricing Tests (11)** - Massage, membership, PT, courses
3. **Services Tests (9)** - Massage types, facility, therapist
4. **Hours Tests (5)** - Working hours, course schedules
5. **Location Tests (5)** - Address, directions, single-word queries
6. **Policy Tests (4)** - Age limits, family membership rules
7. **Membership Tests (4)** - Individual, family, daily, reformer
8. **Kids Course Tests (6)** - All course types
9. **Safety Gate Tests (4)** - Inappropriate content blocking
10. **Follow-up Tests (3)** - Short contextual questions
11. **Company Name Tests (2)** - Verify "Eform Spor Merkezi" usage
12. **Synonym Tests (3)** - "ders" vs "kurs" handling

## Running the Tests

### Prerequisites
- Workflow v27 deployed on Pi (192.168.1.137)
- n8n running and accessible
- Backend running on Pi

### Execute Test Suite

```powershell
# Run all tests
.\.kiro\specs\instagram-ai-testing\test-suite.ps1

# Results will be saved to test-results.csv
```

### Expected Output

```
========================================
Instagram AI Workflow - Test Suite
========================================

### FAQ TESTS ###
--- Testing: FAQ - Kadinlar gunu ---
Message: kadinlar gunu var mi
✅ PASS
Response: Tesisimiz karma hizmet verir...

[... more tests ...]

========================================
TEST RESULTS SUMMARY
========================================
Total Tests: 70
Passed: 67
Failed: 3
Pass Rate: 95.71%

Results exported to: test-results.csv
```

## Test Structure

Each test validates:
- **Intent Detection**: Correct intent classification
- **Safety Decision**: ALLOW/BLOCK/UNSURE
- **Response Accuracy**: Contains relevant information

## Success Criteria

- ✅ Pass rate ≥ 95%
- ✅ All FAQ questions answered correctly
- ✅ All safety gate blocks working
- ✅ Company name always "Eform Spor Merkezi"
- ✅ Synonym handling (ders = kurs)
- ✅ Follow-up questions use context

## Known Issues to Test

1. **Location intent** - "yeriniz nerde", "yer" (single word)
2. **Safety gate** - "mutlu son" must BLOCK
3. **Company name** - Never say "Eform Spa"
4. **Synonym** - "yuzme dersi" = "yuzme kursu"
5. **Follow-up** - Short questions need context

## Troubleshooting

### Test fails with connection error
```powershell
# Check n8n is running
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "systemctl status n8n"

# Restart if needed
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "sudo systemctl restart n8n"
```

### Wrong intent detected
1. Check Enrich Context node patterns
2. Add/modify regex for the intent
3. Redeploy workflow with new versionId
4. Restart n8n

### Wrong response content
1. Check knowledge base has correct data
2. Check AI prompt in admin panel
3. Add hint in Enrich Context if needed

## Updating Tests

When adding new knowledge base entries:
1. Add corresponding test case
2. Update expected intent
3. Run full test suite
4. Document any failures

## Files

- `requirements.md` - Test requirements and goals
- `test-suite.ps1` - PowerShell test script
- `README.md` - This file
- `test-results.csv` - Generated after running tests
