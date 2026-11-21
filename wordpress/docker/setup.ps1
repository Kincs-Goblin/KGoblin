<#
.SYNOPSIS
    KGoblin lokális headless WordPress + WooCommerce környezet telepítő (Windows PowerShell).
.DESCRIPTION
    Elindítja a Docker konténereket, telepíti a WordPress-t, a magyar nyelvi csomagot,
    a WooCommerce-t, a Redis Object Cache-t, aktiválja a kg-headless bővítményt,
    és lefuttatja a gamer tesztadat-seedet.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\wordpress\docker\setup.ps1
#>

[CmdletBinding()]
param(
    [string]$Brand = "gamer"
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $RepoRoot

# 1. Környezeti változók beolvasása (.env vagy .env.example)
$envFile = if (Test-Path "$RepoRoot\.env") { "$RepoRoot\.env" } elseif (Test-Path "$RepoRoot\.env.example") { "$RepoRoot\.env.example" } else { $null }
$envVars = @{}
if ($envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $k = $matches[1].Trim()
            $v = $matches[2].Trim().Trim('"')
            $envVars[$k] = $v
        }
    }
}

# A setup lokális fejlesztői környezetet épít; a compose alapérték nélkül kéri a változót.
$env:WP_ENVIRONMENT_TYPE = if ($envVars["WP_ENVIRONMENT_TYPE"]) { $envVars["WP_ENVIRONMENT_TYPE"] } elseif ($env:WP_ENVIRONMENT_TYPE) { $env:WP_ENVIRONMENT_TYPE } else { "local" }

$Brand         = $Brand.ToLowerInvariant().Trim()
$BrandUpper    = ($Brand -replace '[^a-z0-9]', '_').ToUpperInvariant()
$DefaultPort   = if ($Brand -eq "gamer") { "8080" } else { "8081" }
# Egy next dev szolgálja ki az összes brandet; a brandet a `<brand>.localhost` host választja.
$DefaultFeUrl  = "http://${Brand}.localhost:3000"

$Port          = if ($envVars["WP_${BrandUpper}_PORT"]) { $envVars["WP_${BrandUpper}_PORT"] } else { $DefaultPort }
$Title         = if ($envVars["WP_${BrandUpper}_TITLE"]) { $envVars["WP_${BrandUpper}_TITLE"] } else { "KincsGoblin ($Brand) Backend" }
$AdminUser     = if ($envVars["WP_${BrandUpper}_ADMIN_USER"]) { $envVars["WP_${BrandUpper}_ADMIN_USER"] } elseif ($envVars["WP_GAMER_ADMIN_USER"]) { $envVars["WP_GAMER_ADMIN_USER"] } else { "admin" }
$AdminPassword = if ($envVars["WP_${BrandUpper}_ADMIN_PASSWORD"]) { $envVars["WP_${BrandUpper}_ADMIN_PASSWORD"] } elseif ($envVars["WP_GAMER_ADMIN_PASSWORD"]) { $envVars["WP_GAMER_ADMIN_PASSWORD"] } else { "admin123" }
$AdminEmail    = if ($envVars["WP_${BrandUpper}_ADMIN_EMAIL"]) { $envVars["WP_${BrandUpper}_ADMIN_EMAIL"] } elseif ($envVars["WP_GAMER_ADMIN_EMAIL"]) { $envVars["WP_GAMER_ADMIN_EMAIL"] } else { "admin@kincsgoblin.local" }
$FrontendUrl   = if ($envVars["WP_${BrandUpper}_FRONTEND_URL"]) { $envVars["WP_${BrandUpper}_FRONTEND_URL"] } else { $DefaultFeUrl }
$WebhookSecret = if ($envVars["WOO_${BrandUpper}_WEBHOOK_SECRET"]) { $envVars["WOO_${BrandUpper}_WEBHOOK_SECRET"] } elseif ($envVars["KG_WEBHOOK_SECRET"]) { $envVars["KG_WEBHOOK_SECRET"] } else { "kg_local_${Brand}_webhook_secret" }
$CliService    = "wpcli-$Brand"
$WpService     = "wp-$Brand"

Write-Host "=== [1/6] Docker Desktop és konténerek indítása ($Brand) ===" -ForegroundColor Cyan
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop nem fut, indítás..." -ForegroundColor Yellow
    $ddExe = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
    if (-not (Test-Path $ddExe)) {
        $ddExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    }
    if (Test-Path $ddExe) {
        Start-Process -FilePath $ddExe
    } else {
        docker desktop start >$null 2>&1
    }
    $dockerWait = 0
    while ($dockerWait -lt 45) {
        docker info >$null 2>&1
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
        $dockerWait++
    }
}

docker compose up -d

Write-Host "=== [2/6] Várakozás a WordPress fájlrendszerre és az adatbázisra ===" -ForegroundColor Cyan
# Jogosultságok biztosítása a csatolt wp-content könyvtáron
docker compose exec -T -u 0 $WpService bash -c "mkdir -p /var/www/html/wp-content/uploads /var/www/html/wp-content/upgrade && chown -R www-data:www-data /var/www/html/wp-content" >$null 2>&1

$maxRetries = 35
$retry = 0
while ($retry -lt $maxRetries) {
    docker compose exec -T $CliService php -r "if (!file_exists('/var/www/html/wp-config.php')) exit(1); mysqli_report(MYSQLI_REPORT_OFF); `$c = @mysqli_connect('db', getenv('WORDPRESS_DB_USER'), getenv('WORDPRESS_DB_PASSWORD'), getenv('WORDPRESS_DB_NAME'), 3306); exit(`$c ? 0 : 1);" >$null 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
    $retry++
}

if ($retry -ge $maxRetries) {
    Write-Error "Az adatbázis vagy a wp-config.php nem vált elérhetővé időben."
    exit 1
}

Write-Host "=== [3/6] WordPress core telepítése (ha még nincs) ===" -ForegroundColor Cyan
docker compose exec -T $CliService wp core is-installed --path=/var/www/html >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    docker compose exec -T $CliService wp core install `
        --path=/var/www/html `
        --url="http://localhost:$Port" `
        --title="$Title" `
        --admin_user="$AdminUser" `
        --admin_password="$AdminPassword" `
        --admin_email="$AdminEmail" `
        --skip-email
} else {
    Write-Host "A WordPress már telepítve van, URL és cím frissítése..." -ForegroundColor Green
    docker compose exec -T $CliService wp option update blogname "$Title" --path=/var/www/html
}

Write-Host "=== [4/6] Magyar nyelv, WooCommerce és Redis Object Cache telepítése ===" -ForegroundColor Cyan
docker compose exec -T $CliService wp language core install hu_HU --activate --path=/var/www/html
# A kg-headless fejlécének „WC tested up to” értéke ehhez a verzióhoz igazodik (ADR-0016, ADR-0017).
$WooVersion = if ($env:WOO_VERSION) { $env:WOO_VERSION } else { "11.3.0" }
$CurrentWoo = (docker compose exec -T $CliService wp plugin get woocommerce --field=version --path=/var/www/html 2>$null | Out-String).Trim()
if ($CurrentWoo -ne $WooVersion) {
    # Eltérő verziónál felülírja (a már migrált DB-t nem állítja vissza; újabbról ne lépj vissza éles adaton).
    docker compose exec -T $CliService wp plugin install woocommerce --version=$WooVersion --force --activate --path=/var/www/html
} else {
    docker compose exec -T $CliService wp plugin activate woocommerce --path=/var/www/html
}
docker compose exec -T $CliService wp plugin install redis-cache --activate --path=/var/www/html
docker compose exec -T $CliService wp redis enable --path=/var/www/html >$null 2>&1

Write-Host "=== [5/6] kg-headless bővítmény aktiválása és gamer tesztadatok betöltése ===" -ForegroundColor Cyan
docker compose exec -T $CliService wp plugin activate kg-headless --path=/var/www/html
docker compose exec -T -e KG_BRAND=$Brand -e KG_FRONTEND_URL=$FrontendUrl -e KG_WEBHOOK_SECRET=$WebhookSecret $CliService wp eval-file /var/www/seed/seed-brand.php --path=/var/www/html

Write-Host "=== [6/6] Állapot ellenőrzése ===" -ForegroundColor Cyan
docker compose exec -T $CliService wp plugin list --path=/var/www/html

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " KÉSZ! A KGoblin ($Brand) headless WooCommerce backend fut!" -ForegroundColor Green
Write-Host " - WP Admin:   http://localhost:$Port/wp-admin ($AdminUser / $AdminPassword)" -ForegroundColor Green
Write-Host " - Store API:  http://localhost:$Port/wp-json/wc/store/v1/products" -ForegroundColor Green
Write-Host " - Frontend redirect cél: $FrontendUrl" -ForegroundColor Green
Write-Host " - Webhook titok (WOO_${BrandUpper}_WEBHOOK_SECRET): $WebhookSecret" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
