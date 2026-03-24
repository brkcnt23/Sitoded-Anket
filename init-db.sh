#!/bin/bash
set -e

# Create the custom user with password
psql -v ON_ERROR_STOP=1 --username "postgres" <<-EOSQL
    CREATE USER burakcan_sitoded WITH PASSWORD 'Sitoded25Ikbal';
    ALTER USER burakcan_sitoded CREATEDB SUPERUSER;
    CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;
EOSQL

echo "✓ Database and user created successfully"
