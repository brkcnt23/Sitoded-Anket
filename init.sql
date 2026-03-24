#!/bin/bash
# PostgreSQL init script - Trust auth ayarla
su - postgres -c "cat > /var/lib/postgresql/data/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    all             all             0.0.0.0/0               md5
EOF"

# PostgreSQL'ü reload et
pg_ctl reload -D /var/lib/postgresql/data
