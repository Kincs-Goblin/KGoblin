#!/usr/bin/env bash
# ==============================================================================
# MariaDB inicializáló szkript (többbrandes adatbázis- és jogosultság-elkülönítés)
# Automatikusan lefut az első konténer-indításkor (/docker-entrypoint-initdb.d/).
# Minden brand saját adatbázist és saját, csak arra az adatbázisra jogosult DB-usert kap.
# ==============================================================================
set -euo pipefail

GAMER_DB="${WP_GAMER_DB_NAME:-wp_gamer}"
GAMER_USER="${WP_GAMER_DB_USER:-${WP_DB_USER:-kg_wp_user}}"
GAMER_PASS="${WP_GAMER_DB_PASSWORD:-${WP_DB_PASSWORD:-kg_wp_local_pass}}"

BRAND2_DB="${WP_BRAND2_DB_NAME:-wp_brand2}"
BRAND2_USER="${WP_BRAND2_DB_USER:-kg_wp_brand2_user}"
BRAND2_PASS="${WP_BRAND2_DB_PASSWORD:-${WP_DB_PASSWORD:-kg_wp_local_pass}}"

mariadb -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${GAMER_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${GAMER_USER}'@'%' IDENTIFIED BY '${GAMER_PASS}';
    GRANT ALL PRIVILEGES ON \`${GAMER_DB}\`.* TO '${GAMER_USER}'@'%';

    CREATE DATABASE IF NOT EXISTS \`${BRAND2_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${BRAND2_USER}'@'%' IDENTIFIED BY '${BRAND2_PASS}';
    GRANT ALL PRIVILEGES ON \`${BRAND2_DB}\`.* TO '${BRAND2_USER}'@'%';

    FLUSH PRIVILEGES;
EOSQL
