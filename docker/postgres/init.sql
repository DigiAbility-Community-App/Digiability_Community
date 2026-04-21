-- ─────────────────────────────────────────────────────────────
-- Docker PostgreSQL Initialization Script
-- Runs ONCE when the container is first created.
-- Creates databases for each microservice.
-- ─────────────────────────────────────────────────────────────

-- Create separate schemas/databases per service
-- (user-svc uses the default digiability_db)

-- Create additional service databases
CREATE DATABASE digiability_chat   WITH OWNER digiability;
CREATE DATABASE digiability_groups WITH OWNER digiability;
CREATE DATABASE digiability_notif  WITH OWNER digiability;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE digiability_db     TO digiability;
GRANT ALL PRIVILEGES ON DATABASE digiability_chat   TO digiability;
GRANT ALL PRIVILEGES ON DATABASE digiability_groups TO digiability;
GRANT ALL PRIVILEGES ON DATABASE digiability_notif  TO digiability;
