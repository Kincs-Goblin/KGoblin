<#
.SYNOPSIS
    KGoblin Store API & Headless végpontok integrációs HTTP-tesztje.
.DESCRIPTION
    Ellenőrzi:
    1. Omnibus unit-tesztek futtatása a konténerben
    2. Nem-admin frontend kérés átirányítása (HTTP 302 -> Next.js URL), miközben a /wp-json elérhető (HTTP 200)
    3. Store API /products végponton az extensions.kg_headless.lowest_price_30_days jelenléte (int)
    4. Store API /checkout HTTP 400 hibás magyar adószám esetén (kg_invalid_tax_number)
    5. Store API /checkout HTTP 400 hiányzó ÁSZF elfogadás esetén (kg_terms_not_accepted)
    6. Store API /checkout HTTP 200 sikeres céges rendelésnél + HPOS rendelés-meta ellenőrzés
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\wordpress\docker\test-store-api.ps1
#>

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$CliService = "wpcli-gamer"
)

$ErrorActionPreference = "Stop"
$Failures = 0

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:Failures++ }

Write-Host "=== 1. Omnibus és Adószám PHP Unit-tesztek ===" -ForegroundColor Cyan
docker compose exec -T $CliService php /var/www/seed/test-omnibus.php
if ($LASTEXITCODE -ne 0) { Fail "Omnibus unit-tesztek elbuktak" } else { Pass "Omnibus unit-tesztek zöldek" }

Write-Host "`n=== 2. Headless Frontend Redirect & WP-JSON elérhetőség ===" -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/" -MaximumRedirection 0 -UseBasicParsing -ErrorAction SilentlyContinue
} catch {
    $resp = $_.Exception.Response
}

$statusCode = [int]$resp.StatusCode
if ($statusCode -eq 302) {
    Pass "Nem-admin főoldal kérés HTTP 302-vel átirányít a Next.js storefrontra"
} else {
    Fail "Nem-admin főoldal kérés státusza 302 helyett: $statusCode"
}

$wpJsonResp = Invoke-WebRequest -Uri "$BaseUrl/wp-json/" -UseBasicParsing
if ([int]$wpJsonResp.StatusCode -eq 200) {
    Pass "/wp-json REST API gyökér elérhető (HTTP 200)"
} else {
    Fail "/wp-json nem érhető el"
}

Write-Host "`n=== 3. Store API Termékek és Omnibus kiterjesztés ellenőrzése ===" -ForegroundColor Cyan
$products = Invoke-RestMethod -Uri "$BaseUrl/wp-json/wc/store/v1/products?per_page=20" -Method Get
if ($products.Count -ge 8) {
    Pass "Store API /products visszaadott $($products.Count) gamer terméket (minimum 8 elvárt)"
} else {
    Fail "Store API /products csak $($products.Count) terméket adott vissza"
}

$saleProduct = $products | Where-Object { $_.sku -eq "KG-GMR-KB-001" } | Select-Object -First 1
if ($null -ne $saleProduct -and $saleProduct.extensions.kg_headless.lowest_price_30_days -eq 34990) {
    Pass "KG-GMR-KB-001 Store API extensions.kg_headless.lowest_price_30_days = 34990 (int, akció előtti 30 nap minimuma)"
} else {
    Fail "KG-GMR-KB-001 Omnibus mező hibás vagy hiányzik: $($saleProduct.extensions | ConvertTo-Json -Compress)"
}

Write-Host "`n=== 4. Store API Kosár létrehozása és Cart-Token beszerzése ===" -ForegroundColor Cyan
$cartInit = Invoke-WebRequest -Uri "$BaseUrl/wp-json/wc/store/v1/cart" -Method Get -UseBasicParsing
$cartToken = $cartInit.Headers["Cart-Token"]
if ($cartToken -is [array]) { $cartToken = $cartToken[0] }
$nonce = $cartInit.Headers["Nonce"]
if ($nonce -is [array]) { $nonce = $nonce[0] }

$headers = @{
    "Cart-Token"   = $cartToken
    "Content-Type" = "application/json"
}
if ($nonce) { $headers["Nonce"] = $nonce }

$addBody = @{
    id       = $saleProduct.id
    quantity = 1
} | ConvertTo-Json

$addResp = Invoke-WebRequest -Uri "$BaseUrl/wp-json/wc/store/v1/cart/add-item" -Method Post -Headers $headers -Body $addBody -UseBasicParsing
if ($addResp.Headers["Cart-Token"]) {
    $ct = $addResp.Headers["Cart-Token"]
    $headers["Cart-Token"] = if ($ct -is [array]) { $ct[0] } else { $ct }
}
Pass "Termék (#$($saleProduct.id)) sikeresen kosárba téve Store API-n keresztül"

$baseAddress = @{
    first_name = "Teszt"
    last_name  = "Elek"
    address_1  = "Kossuth Lajos utca 12."
    city       = "Budapest"
    postcode   = "1053"
    country    = "HU"
    email      = "teszt.elek@kincsgoblin.local"
    phone      = "+36301234567"
}

Write-Host "`n=== 5. Store API /checkout negatív teszt: Hiányzó ÁSZF elfogadás (400 elvárt) ===" -ForegroundColor Cyan
$missingTermsBody = @{
    billing_address  = $baseAddress
    shipping_address = $baseAddress
    payment_method   = "cod"
    extensions       = @{
        kg_headless = @{
            is_company                = $false
            accept_terms              = $false
            accept_payment_obligation = $true
        }
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-WebRequest -Uri "$BaseUrl/wp-json/wc/store/v1/checkout" -Method Post -Headers $headers -Body $missingTermsBody -UseBasicParsing | Out-Null
    Fail "Hiányzó ÁSZF esetén nem dobott 400-as hibát!"
} catch {
    $errResp = $_.Exception.Response
    $status = [int]$errResp.StatusCode
    $errBody = if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    } else {
        $stream = New-Object System.IO.StreamReader($errResp.GetResponseStream())
        $stream.ReadToEnd()
    }
    if ($status -eq 400 -and $errBody -match "kg_terms_not_accepted") {
        Pass "Hiányzó ÁSZF elutasítva HTTP 400-zal (kg_terms_not_accepted): $errBody"
    } else {
        Fail "Váratlan válasz hiányzó ÁSZF-re ($status): $errBody"
    }
}

Write-Host "`n=== 6. Store API /checkout negatív teszt: Hibás magyar adószám (400 elvárt) ===" -ForegroundColor Cyan
$invalidTaxBody = @{
    billing_address  = $baseAddress
    shipping_address = $baseAddress
    payment_method   = "cod"
    extensions       = @{
        kg_headless = @{
            is_company                = $true
            company_name              = "KincsGoblin Teszt Kft."
            tax_number                = "12345-HIBAS"
            accept_terms              = $true
            accept_payment_obligation = $true
        }
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-WebRequest -Uri "$BaseUrl/wp-json/wc/store/v1/checkout" -Method Post -Headers $headers -Body $invalidTaxBody -UseBasicParsing | Out-Null
    Fail "Hibás adószám esetén nem dobott 400-as hibát!"
} catch {
    $errResp = $_.Exception.Response
    $status = [int]$errResp.StatusCode
    $errBody = if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    } else {
        $stream = New-Object System.IO.StreamReader($errResp.GetResponseStream())
        $stream.ReadToEnd()
    }
    if ($status -eq 400 -and $errBody -match "kg_invalid_tax_number") {
        Pass "Hibás magyar adószám elutasítva HTTP 400-zal (kg_invalid_tax_number): $errBody"
    } else {
        Fail "Váratlan válasz hibás adószámra ($status): $errBody"
    }
}

Write-Host "`n=== 7. Store API /checkout pozitív teszt: Érvényes céges rendelés + HPOS meta ===" -ForegroundColor Cyan
$validCheckoutBody = @{
    billing_address  = $baseAddress
    shipping_address = $baseAddress
    payment_method   = "cod"
    extensions       = @{
        kg_headless = @{
            is_company                = $true
            company_name              = "KincsGoblin Gamer Kft."
            tax_number                = "12345678-2-42"
            accept_terms              = $true
            accept_payment_obligation = $true
        }
    }
} | ConvertTo-Json -Depth 5

$checkoutResp = Invoke-WebRequest -Uri "$BaseUrl/wp-json/wc/store/v1/checkout" -Method Post -Headers $headers -Body $validCheckoutBody -UseBasicParsing
$orderJson = $checkoutResp.Content | ConvertFrom-Json
$orderId = $orderJson.order_id

if ([int]$checkoutResp.StatusCode -eq 200 -and $orderId -gt 0) {
    Pass "Sikeres céges rendelés Store API-n keresztül (Order ID: #$orderId)"
} else {
    Fail "Sikertelen rendelés válasz: $($checkoutResp.Content)"
}

# HPOS rendelés-meta ellenőrzése WP-CLI-vel közvetlenül a WC_Order objektumból
$phpCheck = "
`$order = wc_get_order($orderId);
echo json_encode(array(
    'is_company' => `$order->get_meta('_billing_is_company', true),
    'company_name' => `$order->get_meta('_billing_company_name', true),
    'tax_number' => `$order->get_meta('_billing_tax_number', true),
    'terms' => `$order->get_meta('_hu_accepted_terms_privacy', true),
    'payment_ob' => `$order->get_meta('_hu_accepted_payment_obligation', true),
    'accepted_at' => `$order->get_meta('_hu_legal_accepted_at', true),
));
"
$metaRaw = docker compose exec -T $CliService wp eval $phpCheck --path=/var/www/html
$meta = $metaRaw | ConvertFrom-Json

if (
    $meta.is_company -eq "yes" -and
    $meta.company_name -eq "KincsGoblin Gamer Kft." -and
    $meta.tax_number -eq "12345678-2-42" -and
    $meta.terms -eq "yes" -and
    $meta.payment_ob -eq "yes" -and
    -not [string]::IsNullOrWhiteSpace($meta.accepted_at)
) {
    Pass "HPOS rendelés-metaadatok maradéktalanul rögzítve: $($meta | ConvertTo-Json -Compress)"
} else {
    Fail "HPOS rendelés-metaadat hiányos: $metaRaw"
}

if ($Failures -gt 0) {
    Write-Host "`nÖSSZESÍTÉS: $Failures teszt ELBUKOTT!" -ForegroundColor Red
    exit 1
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " MINDEN STORE API, OMNIBUS ÉS HPOS TESZT SIKERES (0 HIBA)!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
