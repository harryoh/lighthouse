-- Create lighthouse database if not exists
CREATE DATABASE IF NOT EXISTS lighthouse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the lighthouse database
USE lighthouse;

-- Create user if not exists (for application connection)
CREATE USER IF NOT EXISTS 'lighthouse_user'@'%' IDENTIFIED BY 'lighthouse_password';

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON lighthouse.* TO 'lighthouse_user'@'%';
GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON lighthouse.* TO 'lighthouse_user'@'%';

-- Flush privileges to ensure they take effect
FLUSH PRIVILEGES;

-- Log successful initialization
SELECT 'Lighthouse database initialized successfully' AS status;