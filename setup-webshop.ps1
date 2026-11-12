# Saját Webshop – Automatikus Docker + WP-CLI Telepítő Szkript
$ErrorActionPreference = "Continue"

Write-Host "=== 0. Docker Desktop ellenőrzése/indítása ===" -ForegroundColor Cyan
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    docker desktop start
}

Write-Host "=== 1. Docker konténerek ellenőrzése/indítása ===" -ForegroundColor Cyan
docker compose up -d

Write-Host "Várakozás a WordPress fájlok (wp-config.php) és az adatbázis inicializálására..." -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
while (-not (Test-Path "./wordpress/wp-config.php") -and ($retry -lt $maxRetries)) {
    Start-Sleep -Seconds 2
    $retry++
}

# Várunk, amíg az adatbázis kapcsolat a wpcli konténerből is stabilan elérhető
$dbRetries = 20
$dbRetry = 0
while ($dbRetry -lt $dbRetries) {
    docker compose exec -T wpcli wp db check --path=/var/www/html >$null 2>&1
    if ($LASTEXITCODE -eq 0) {
        break
    }
    Start-Sleep -Seconds 2
    $dbRetry++
}

Write-Host "=== 2. WordPress core telepítése WP-CLI-vel ===" -ForegroundColor Cyan
docker compose exec -T wpcli wp core is-installed --path=/var/www/html
if ($LASTEXITCODE -ne 0) {
    docker compose exec -T wpcli wp core install `
        --path=/var/www/html `
        --url="http://localhost:8080" `
        --title="Sajat Webshop" `
        --admin_user="admin" `
        --admin_password="admin123" `
        --admin_email="admin@sajatwebshop.hu" `
        --skip-email
} else {
    Write-Host "A WordPress már telepítve van, cím frissítése..." -ForegroundColor Green
    docker compose exec -T wpcli wp option update blogname "Sajat Webshop" --path=/var/www/html
}

Write-Host "=== 3. Magyar nyelvi csomag és WooCommerce telepítése/aktiválása ===" -ForegroundColor Cyan
docker compose exec -T wpcli wp language core install hu_HU --activate --path=/var/www/html
docker compose exec -T wpcli wp plugin install woocommerce --activate --path=/var/www/html

Write-Host "=== 4. Egyedi téma (custom-shop) és magyar jogi plugin (hu-webshop-core) aktiválása ===" -ForegroundColor Cyan
docker compose exec -T wpcli wp theme activate custom-shop --path=/var/www/html
docker compose exec -T wpcli wp plugin activate hu-webshop-core --path=/var/www/html

Write-Host "=== 5. Alapoldalak, 3 kategória, 8 magyar teszttermék, HPOS és fizetési módok beállítása ===" -ForegroundColor Cyan
docker compose exec -T wpcli wp eval-file wp-content/plugins/hu-webshop-core/includes/seed-demo-data.php --path=/var/www/html

Write-Host "=== 6. Telepített bővítmények, témák és termékek ellenőrzése ===" -ForegroundColor Cyan
docker compose exec -T wpcli wp plugin list --path=/var/www/html
docker compose exec -T wpcli wp theme list --path=/var/www/html

Write-Host "=== KÉSZ! A Sajat Webshop elérhető: http://localhost:8080 (Admin: admin / admin123) ===" -ForegroundColor Green
