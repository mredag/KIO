# Multi-Intent Test Suite for Instagram AI Workflow
# Tests v29 (current) to identify gaps before deploying v30

$tests = @(
    @{Num=1; Q="masaj fiyatlari ve calisma saatleri nedir"; ExpectHours=$true; ExpectPricing=$true; ExpectAddress=$false},
    @{Num=2; Q="uyelik ucretleri ve saat kaca kadar acik"; ExpectHours=$true; ExpectPricing=$true; ExpectAddress=$false},
    @{Num=3; Q="pilates fiyat ve ne zaman acik"; ExpectHours=$true; ExpectPricing=$true; ExpectAddress=$false},
    @{Num=4; Q="masaj fiyatlari ve adres nerede"; ExpectHours=$false; ExpectPricing=$true; ExpectAddress=$true},
    @{Num=5; Q="fitness uyeligi ne kadar ve nasil gidilir"; ExpectHours=$false; ExpectPricing=$true; ExpectAddress=$true},
    @{Num=6; Q="hangi masajlar var ve fiyatlari ne kadar"; ExpectHours=$false; ExpectPricing=$true; ExpectAddress=$false},
    @{Num=7; Q="cocuk kurslari neler var ve fiyatlari"; ExpectHours=$false; ExpectPricing=$true; ExpectAddress=$false},
    @{Num=8; Q="pt var mi ve fiyati ne kadar"; ExpectHours=$false; ExpectPricing=$true; ExpectAddress=$false},
    @{Num=9; Q="saat kaca kadar acik ve adres nerede"; ExpectHours=$true; ExpectPricing=$false; ExpectAddress=$true},
    @{Num=10; Q="hangi hizmetler var ve calisma saatleri"; ExpectHours=$true; ExpectPricing=$false; ExpectAddress=$false}
)

$results = @()

foreach ($test in $tests) {
    Write-Host "`n=== TEST $($test.Num): $($test.Q) ===" -ForegroundColor Cyan
    
    try {
        $body = "{`"message`": `"$($test.Q)`"}"
        $result = Invoke-RestMethod -Uri "http://192.168.1.9:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
        
        $hasHours = $result.response -match 'saat|acik|kapali|calisma'
        $hasPricing = $result.response -match 'fiyat|TL|ucret'
        $hasAddress = $result.response -match 'adres|Ankara|Cankaya' -and $result.response -notmatch 'veremiyorum|bilmiyorum'
        
        $hoursPass = ($test.ExpectHours -eq $hasHours)
        $pricingPass = ($test.ExpectPricing -eq $hasPricing)
        $addressPass = ($test.ExpectAddress -eq $hasAddress)
        $allPass = $hoursPass -and $pricingPass -and $addressPass
        
        Write-Host "Intent: $($result.intent)" -ForegroundColor Yellow
        Write-Host "Hours: $(if($hoursPass){'✅'}else{'❌'}) (Expected: $($test.ExpectHours), Got: $hasHours)" -ForegroundColor $(if($hoursPass){'Green'}else{'Red'})
        Write-Host "Pricing: $(if($pricingPass){'✅'}else{'❌'}) (Expected: $($test.ExpectPricing), Got: $hasPricing)" -ForegroundColor $(if($pricingPass){'Green'}else{'Red'})
        Write-Host "Address: $(if($addressPass){'✅'}else{'❌'}) (Expected: $($test.ExpectAddress), Got: $hasAddress)" -ForegroundColor $(if($addressPass){'Green'}else{'Red'})
        Write-Host "Status: $(if($allPass){'PASS'}else{'FAIL'})" -ForegroundColor $(if($allPass){'Green'}else{'Red'})
        
        $results += [PSCustomObject]@{
            Test = $test.Num
            Question = $test.Q
            Intent = $result.intent
            HoursPass = $hoursPass
            PricingPass = $pricingPass
            AddressPass = $addressPass
            Status = if($allPass){'PASS'}else{'FAIL'}
            ResponseTime = $result.responseTime
        }
    }
    catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Test = $test.Num
            Question = $test.Q
            Status = 'ERROR'
            Error = $_.Exception.Message
        }
    }
    
    Start-Sleep -Seconds 2
}

Write-Host "`n`n=== SUMMARY ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$passCount = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
$totalCount = $results.Count
Write-Host "`nPassed: $passCount / $totalCount ($([math]::Round($passCount/$totalCount*100, 1))%)" -ForegroundColor $(if($passCount -eq $totalCount){'Green'}else{'Yellow'})

# Identify gaps
$failedTests = $results | Where-Object { $_.Status -eq 'FAIL' }
if ($failedTests.Count -gt 0) {
    Write-Host "`n=== FAILED TESTS ===" -ForegroundColor Red
    $failedTests | ForEach-Object {
        Write-Host "Test $($_.Test): $($_.Question)" -ForegroundColor Yellow
    }
}
