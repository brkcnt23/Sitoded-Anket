#!/bin/bash
# Copy pg_hba.conf to the correct location after database initialization
cp /var/lib/postgresql/pg_hba.conf /var/lib/postgresql/data/pgdata/pg_hba.conf
chown postgres:postgres /var/lib/postgresql/data/pgdata/pg_hba.conf
chmod 600 /var/lib/postgresql/data/pgdata/pg_hba.conf
echo "✓ pg_hba.conf configured"
