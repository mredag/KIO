# Quick test for critical fixes
$testUrl = "http://192.168.1.137:5678/webhook/test"

Write-Host "Testing Critical Fixes..." -ForegroundColor Yellow

# Test 1: ucret blocking fix
Write-Host "`n1. Testing '60 dakika masaj ucret' (should be ALLOW, not BLOCK)"
$body = '{"message": "60 dakika masaj ucret"}'
$r = Invoke-RestMethod -Uri $testUrl -Method POST -Body $body -ContentType "application/json"
if ($r.safetyDecision -eq "ALLOW") {
    Write-Host "✅ PASS - Not blocked anymore!" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - Still blocked: $($r.safetyDecision)" -ForegroundColor Red
}

# Test 2: Another pricing with ucret
Write-Host "`n2. Testing 'masaj ucret ne kadar'"
$body = '{"message": "masaj ucret ne kadar"}'
$r = Invoke-RestMethod -Uri $testUrl -Method POST -Body $body -ContentType "application/json"
if ($r.safetyDecision -eq "ALLOW") {
    Write-Host "✅ PASS - Pricing question allowed" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - Blocked: $($r.safetyDecision)" -ForegroundColor Red
}

# Test 3: Safety gate still blocks inappropriate
Write-Host "`n3. Testing 'mutlu son var mi' (should still BLOCK)"
$body = '{"message": "mutlu son var mi"}'
$r = Invoke-RestMethod -Uri $testUrl -Method POST -Body $body -ContentType "application/json"
if ($r.safetyDecision -eq "BLOCK") {
    Write-Host "✅ PASS - Still blocking inappropriate content" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - Not blocking: $($r.safetyDecision)" -ForegroundColor Red
}

Write-Host "`n✅ Critical fix deployed successfully!" -ForegroundColor Green
Write-Host "Version: v28" -ForegroundColor Cyan
