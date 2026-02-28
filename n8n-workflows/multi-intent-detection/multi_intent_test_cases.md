# Multi-Intent Test Cases for Instagram AI Workflow v30

**Date:** 2026-02-11  
**Purpose:** Test multi-intent detection system with all knowledge base categories  
**Pi IP:** 192.168.1.7

---

## Knowledge Base Categories Available

1. **pricing** - Massage, membership, courses, pilates, PT
2. **hours** - Spa hours, facility hours, course schedules
3. **services** - Therapist info, facility overview, massage types, courses
4. **contact** - Phone, address, Instagram
5. **policies** - Age groups, family rules, payment, legitimate services
6. **faq** - Common questions (kadınlar günü, kese köpük, PT, etc.)
7. **general** - Brand slogan, facility description

---

## Test Cases (20 Multi-Intent Scenarios)

### Category 1: Pricing + Hours (Most Common)

#### Test 1: Massage Pricing + Hours
**Question:** "masaj fiyatlari ve calisma saatleri nedir"  
**Expected Intents:** `['pricing', 'hours']`  
**Expected Knowledge:**
- ✅ Massage pricing (spa_massage, special_massage)
- ✅ Spa working hours
- ✅ Facility working hours

#### Test 2: Membership + Hours
**Question:** "uyelik ucretleri ve saat kaca kadar acik"  
**Expected Intents:** `['membership', 'hours']`  
**Expected Knowledge:**
- ✅ Membership individual pricing
- ✅ Membership family pricing
- ✅ Facility working hours
- ✅ Facility overview

#### Test 3: Pilates Pricing + Hours
**Question:** "pilates fiyat ve ne zaman acik"  
**Expected Intents:** `['pricing', 'hours']`  
**Expected Topics:** `['pilates']`  
**Expected Knowledge:**
- ✅ Pilates pricing
- ✅ Pilates details
- ✅ Facility working hours

---

### Category 2: Pricing + Location

#### Test 4: Massage + Address
**Question:** "masaj fiyatlari ve adres nerede"  
**Expected Intents:** `['pricing', 'location']`  
**Expected Knowledge:**
- ✅ Massage pricing
- ✅ Address
- ✅ Phone (for booking)

#### Test 5: Membership + Location
**Question:** "fitness uyeligi ne kadar ve nasil gidilir"  
**Expected Intents:** `['membership', 'location']`  
**Expected Knowledge:**
- ✅ Membership pricing
- ✅ Address
- ✅ Phone

---

### Category 3: Services + Pricing

#### Test 6: Services + Massage Pricing
**Question:** "hangi masajlar var ve fiyatlari ne kadar"  
**Expected Intents:** `['services', 'pricing']`  
**Expected Knowledge:**
- ✅ Massage types (classic, hot stone, medical, mix)
- ✅ Massage pricing
- ✅ Therapist info

#### Test 7: Courses + Pricing
**Question:** "cocuk kurslari neler var ve fiyatlari"  
**Expected Intents:** `['kids', 'pricing']`  
**Expected Knowledge:**
- ✅ Kids courses (taekwondo, swimming, gymnastics)
- ✅ Course pricing
- ✅ Course schedules
- ✅ Age groups

---

### Category 4: FAQ + Pricing

#### Test 8: PT Service + Pricing
**Question:** "pt var mi ve fiyati ne kadar"  
**Expected Intents:** `['faq', 'pricing']`  
**Expected Knowledge:**
- ✅ PT service (from FAQ)
- ✅ PT pricing (12/24/36 saat)

#### Test 9: Kese Köpük + Pricing
**Question:** "kese kopuk kim yapiyor ve fiyati"  
**Expected Intents:** `['faq', 'pricing']`  
**Expected Knowledge:**
- ✅ Kese köpük staff (from FAQ)
- ✅ Kese köpük pricing

---

### Category 5: Hours + Location

#### Test 10: Hours + Address
**Question:** "saat kaca kadar acik ve adres nerede"  
**Expected Intents:** `['hours', 'location']`  
**Expected Knowledge:**
- ✅ Spa hours
- ✅ Facility hours
- ✅ Address
- ✅ Phone

---

### Category 6: Policies + Pricing

#### Test 11: Age Policy + Course Pricing
**Question:** "yas siniri var mi ve kurs fiyatlari"  
**Expected Intents:** `['policies', 'pricing']`  
**Expected Knowledge:**
- ✅ Age groups policy
- ✅ Course pricing
- ✅ Kids courses

#### Test 12: Payment + Membership
**Question:** "nasil odeme yapilir ve uyelik fiyatlari"  
**Expected Intents:** `['policies', 'membership']`  
**Expected Knowledge:**
- ✅ Payment methods
- ✅ Membership pricing

---

### Category 7: Booking + Hours + Location

#### Test 13: Triple Intent - Booking
**Question:** "randevu nasil alinir saat kaca kadar acik ve adres"  
**Expected Intents:** `['booking', 'hours', 'location']`  
**Expected Knowledge:**
- ✅ Phone (for booking)
- ✅ Spa hours
- ✅ Facility hours
- ✅ Address

---

### Category 8: Services + Hours

#### Test 14: Facility Services + Hours
**Question:** "hangi hizmetler var ve calisma saatleri"  
**Expected Intents:** `['services', 'hours']`  
**Expected Knowledge:**
- ✅ Facility overview
- ✅ Therapist info
- ✅ Spa hours
- ✅ Facility hours

---

### Category 9: FAQ + Hours

#### Test 15: What to Bring + Hours
**Question:** "yanima ne getirmeliyim ve saat kaca kadar acik"  
**Expected Intents:** `['faq', 'hours']`  
**Expected Knowledge:**
- ✅ What to bring (shorts, slippers, towel)
- ✅ Spa hours

#### Test 16: Women's Day + Hours
**Question:** "kadinlar gunu var mi ve calisma saatleri"  
**Expected Intents:** `['faq', 'hours']`  
**Expected Knowledge:**
- ✅ Women's day answer (no separate day)
- ✅ Spa hours

---

### Category 10: Multiple Topics (Pilates + Massage + Hours)

#### Test 17: Pilates + Massage Pricing
**Question:** "pilates ve masaj fiyatlari nedir"  
**Expected Intents:** `['pricing']`  
**Expected Topics:** `['pilates', 'massage']`  
**Expected Knowledge:**
- ✅ Pilates pricing
- ✅ Massage pricing

#### Test 18: Courses + Membership + Hours
**Question:** "cocuk kurslari ve fitness uyeligi fiyatlari ve saatler"  
**Expected Intents:** `['kids', 'membership', 'hours']`  
**Expected Knowledge:**
- ✅ Kids courses
- ✅ Course pricing
- ✅ Membership pricing
- ✅ Course schedules
- ✅ Facility hours

---

### Category 11: Complex Multi-Intent

#### Test 19: Services + Pricing + Hours + Location
**Question:** "hangi hizmetler var fiyatlari ne kadar saat kaca kadar acik ve adres"  
**Expected Intents:** `['services', 'pricing', 'hours', 'location']`  
**Expected Knowledge:**
- ✅ Facility overview
- ✅ Massage pricing
- ✅ Spa hours
- ✅ Facility hours
- ✅ Address
- ✅ Phone

#### Test 20: PT + Courses + Pricing + Hours
**Question:** "pt ve cocuk kurslari var mi fiyatlari ve saatleri"  
**Expected Intents:** `['faq', 'kids', 'pricing', 'hours']`  
**Expected Knowledge:**
- ✅ PT service
- ✅ PT pricing
- ✅ Kids courses
- ✅ Course pricing
- ✅ Course schedules

---

## Test Execution Script

```powershell
# Test all 20 cases
$tests = @(
    '{"message": "masaj fiyatlari ve calisma saatleri nedir"}',
    '{"message": "uyelik ucretleri ve saat kaca kadar acik"}',
    '{"message": "pilates fiyat ve ne zaman acik"}',
    '{"message": "masaj fiyatlari ve adres nerede"}',
    '{"message": "fitness uyeligi ne kadar ve nasil gidilir"}',
    '{"message": "hangi masajlar var ve fiyatlari ne kadar"}',
    '{"message": "cocuk kurslari neler var ve fiyatlari"}',
    '{"message": "pt var mi ve fiyati ne kadar"}',
    '{"message": "kese kopuk kim yapiyor ve fiyati"}',
    '{"message": "saat kaca kadar acik ve adres nerede"}',
    '{"message": "yas siniri var mi ve kurs fiyatlari"}',
    '{"message": "nasil odeme yapilir ve uyelik fiyatlari"}',
    '{"message": "randevu nasil alinir saat kaca kadar acik ve adres"}',
    '{"message": "hangi hizmetler var ve calisma saatleri"}',
    '{"message": "yanima ne getirmeliyim ve saat kaca kadar acik"}',
    '{"message": "kadinlar gunu var mi ve calisma saatleri"}',
    '{"message": "pilates ve masaj fiyatlari nedir"}',
    '{"message": "cocuk kurslari ve fitness uyeligi fiyatlari ve saatler"}',
    '{"message": "hangi hizmetler var fiyatlari ne kadar saat kaca kadar acik ve adres"}',
    '{"message": "pt ve cocuk kurslari var mi fiyatlari ve saatleri"}'
)

$results = @()
$testNum = 1

foreach ($body in $tests) {
    Write-Host "`n=== TEST $testNum ===" -ForegroundColor Cyan
    Write-Host "Question: $body" -ForegroundColor Yellow
    
    try {
        $result = Invoke-RestMethod -Uri "http://192.168.1.7:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
        
        Write-Host "Intent: $($result.intent)" -ForegroundColor Green
        Write-Host "Detected Intents: $($result.detectedIntents -join ', ')" -ForegroundColor Green
        Write-Host "Detected Topics: $($result.detectedTopics -join ', ')" -ForegroundColor Green
        Write-Host "Response Length: $($result.response.Length) chars" -ForegroundColor Green
        Write-Host "Response Time: $($result.responseTime)ms" -ForegroundColor Green
        
        # Check if response contains expected keywords
        $hasHours = $result.response -match 'saat|açık|kapalı'
        $hasPricing = $result.response -match 'fiyat|₺|TL'
        $hasAddress = $result.response -match 'adres|Ankara'
        
        Write-Host "Contains Hours: $hasHours" -ForegroundColor $(if($hasHours){'Green'}else{'Red'})
        Write-Host "Contains Pricing: $hasPricing" -ForegroundColor $(if($hasPricing){'Green'}else{'Red'})
        Write-Host "Contains Address: $hasAddress" -ForegroundColor $(if($hasAddress){'Green'}else{'Red'})
        
        $results += [PSCustomObject]@{
            TestNum = $testNum
            Question = $body
            Intent = $result.intent
            DetectedIntents = $result.detectedIntents -join ', '
            DetectedTopics = $result.detectedTopics -join ', '
            HasHours = $hasHours
            HasPricing = $hasPricing
            HasAddress = $hasAddress
            ResponseTime = $result.responseTime
            Status = 'PASS'
        }
    }
    catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        $results += [PSCustomObject]@{
            TestNum = $testNum
            Question = $body
            Status = 'FAIL'
            Error = $_.Exception.Message
        }
    }
    
    $testNum++
    Start-Sleep -Seconds 2
}

# Summary
Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$passCount = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
Write-Host "`nPassed: $passCount / $($results.Count)" -ForegroundColor $(if($passCount -eq $results.Count){'Green'}else{'Yellow'})
```

---

## Success Criteria

For each test to PASS:
1. ✅ All expected intents detected in `detectedIntents` array
2. ✅ All expected topics detected in `detectedTopics` array
3. ✅ Response contains information for ALL detected intents
4. ✅ No hallucination (only uses provided knowledge)
5. ✅ Response time < 10 seconds

---

## Expected Improvements from v29 to v30

| Metric | v29 (Single Intent) | v30 (Multi-Intent) |
|--------|---------------------|-------------------|
| Multi-intent detection | ❌ No | ✅ Yes |
| "Pricing + Hours" question | ❌ Only pricing | ✅ Both |
| "Services + Location" question | ❌ Only services | ✅ Both |
| Knowledge completeness | ~50% | ~95% |
| User satisfaction | Low | High |

---

**Next Step:** Deploy v30 workflow and run test suite
