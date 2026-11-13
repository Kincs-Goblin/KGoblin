#!/usr/bin/env bash
# ==============================================================================
# KGoblin lokális headless WordPress + WooCommerce környezet telepítő (Linux / macOS)
# Használat: ./wordpress/docker/setup.sh [brand]
# ==============================================================================
set -euo pipefail

BRAND="$(echo "${1:-gamer}" | tr '[:upper:]' '[:lower:]')"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
elif [[ -f "$REPO_ROOT/.env.example" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.example"
  set +a
fi

BRAND_UPPER="$(echo "$BRAND" | tr '[:lower:]' '[:upper:]' | sed 's/[^A-Z0-9]/_/g')"
DEFAULT_PORT="8081"
DEFAULT_FE_URL="http://localhost:3001"
if [[ "$BRAND" == "gamer" ]]; then
  DEFAULT_PORT="8080"
  DEFAULT_FE_URL="http://localhost:3000"
fi

PORT_VAR="WP_${BRAND_UPPER}_PORT"
TITLE_VAR="WP_${BRAND_UPPER}_TITLE"
USER_VAR="WP_${BRAND_UPPER}_ADMIN_USER"
PASS_VAR="WP_${BRAND_UPPER}_ADMIN_PASSWORD"
EMAIL_VAR="WP_${BRAND_UPPER}_ADMIN_EMAIL"
FE_VAR="WP_${BRAND_UPPER}_FRONTEND_URL"

PORT="${!PORT_VAR:-$DEFAULT_PORT}"
TITLE="${!TITLE_VAR:-KincsGoblin (${BRAND}) Backend}"
ADMIN_USER="${!USER_VAR:-${WP_GAMER_ADMIN_USER:-admin}}"
ADMIN_PASSWORD="${!PASS_VAR:-${WP_GAMER_ADMIN_PASSWORD:-admin123}}"
ADMIN_EMAIL="${!EMAIL_VAR:-${WP_GAMER_ADMIN_EMAIL:-admin@kincsgoblin.local}}"
FRONTEND_URL="${!FE_VAR:-$DEFAULT_FE_URL}"
CLI_SERVICE="wpcli-${BRAND}"
WP_SERVICE="wp-${BRAND}"

echo "=== [1/6] Docker konténerek indítása ($BRAND) ==="
docker compose up -d

echo "=== [2/6] Várakozás a WordPress fájlrendszerre és az adatbázisra ==="
docker compose exec -T -u 0 "$WP_SERVICE" bash -c "mkdir -p /var/www/html/wp-content/uploads /var/www/html/wp-content/upgrade && chown -R www-data:www-data /var/www/html/wp-content" >/dev/null 2>&1 || true

MAX_RETRIES=35
RETRY=0
until docker compose exec -T "$CLI_SERVICE" php -r "if (!file_exists('/var/www/html/wp-config.php')) exit(1); mysqli_report(MYSQLI_REPORT_OFF); \$c = @mysqli_connect('db', getenv('WORDPRESS_DB_USER'), getenv('WORDPRESS_DB_PASSWORD'), getenv('WORDPRESS_DB_NAME'), 3306); exit(\$c ? 0 : 1);" >/dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [[ $RETRY -ge $MAX_RETRIES ]]; then
    echo "HIBA: Az adatbázis nem vált elérhetővé időben." >&2
    exit 1
  fi
  sleep 2
done

echo "=== [3/6] WordPress core telepítése (ha még nincs) ==="
if ! docker compose exec -T "$CLI_SERVICE" wp core is-installed --path=/var/www/html >/dev/null 2>&1; then
  docker compose exec -T "$CLI_SERVICE" wp core install \
    --path=/var/www/html \
    --url="http://localhost:${PORT}" \
    --title="${TITLE}" \
    --admin_user="${ADMIN_USER}" \
    --admin_password="${ADMIN_PASSWORD}" \
    --admin_email="${ADMIN_EMAIL}" \
    --skip-email
else
  echo "A WordPress már telepítve van, cím frissítése..."
  docker compose exec -T "$CLI_SERVICE" wp option update blogname "${TITLE}" --path=/var/www/html
fi

echo "=== [4/6] Magyar nyelv, WooCommerce és Redis Object Cache telepítése ==="
docker compose exec -T "$CLI_SERVICE" wp language core install hu_HU --activate --path=/var/www/html
docker compose exec -T "$CLI_SERVICE" wp plugin install woocommerce --activate --path=/var/www/html
docker compose exec -T "$CLI_SERVICE" wp plugin install redis-cache --activate --path=/var/www/html
docker compose exec -T "$CLI_SERVICE" wp redis enable --path=/var/www/html >/dev/null 2>&1 || true

echo "=== [5/6] kg-headless bővítmény aktiválása és gamer tesztadatok betöltése ==="
docker compose exec -T "$CLI_SERVICE" wp plugin activate kg-headless --path=/var/www/html
docker compose exec -T -e KG_BRAND="$BRAND" -e KG_FRONTEND_URL="$FRONTEND_URL" "$CLI_SERVICE" wp eval-file /var/www/seed/seed-brand.php --path=/var/www/html

echo "=== [6/6] Állapot ellenőrzése ==="
docker compose exec -T "$CLI_SERVICE" wp plugin list --path=/var/www/html

echo "=================================================================="
echo " KÉSZ! A KGoblin ($BRAND) headless WooCommerce backend fut!"
echo " - WP Admin:   http://localhost:${PORT}/wp-admin (${ADMIN_USER} / ${ADMIN_PASSWORD})"
echo " - Store API:  http://localhost:${PORT}/wp-json/wc/store/v1/products"
echo " - Frontend redirect cél: ${FRONTEND_URL}"
echo "=================================================================="
