-- Create superuser
CREATE USER burakcan_sitoded WITH PASSWORD 'Sitoded25Ikbal' SUPERUSER;

-- Create database
CREATE DATABASE burakcan_sitoded_db OWNER burakcan_sitoded;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE burakcan_sitoded_db TO burakcan_sitoded;
