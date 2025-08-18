#!/bin/bash

# Lighthouse Database Restore Script
# Usage: ./scripts/restore-database.sh <backup-file> [environment]
# Example: ./scripts/restore-database.sh backups/lighthouse_development_20250818_120000.sql.gz development

set -e

# Configuration
BACKUP_FILE=$1
ENVIRONMENT=${2:-development}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "${BACKUP_FILE}" ]; then
  echo -e "${RED}Error: No backup file specified${NC}"
  echo "Usage: $0 <backup-file> [environment]"
  echo "Example: $0 backups/lighthouse_development_20250818_120000.sql.gz development"
  exit 1
fi

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
  echo -e "${RED}Error: Backup file '${BACKUP_FILE}' not found${NC}"
  exit 1
fi

echo -e "${YELLOW}Starting database restore for ${ENVIRONMENT} environment...${NC}"
echo -e "Backup file: ${BACKUP_FILE}"

# Environment-specific configuration
case ${ENVIRONMENT} in
  development)
    CONTAINER_NAME="lighthouse-mysql"
    DB_USER="lighthouse_user"
    DB_PASSWORD="lighthouse_password"
    DB_NAME="lighthouse"
    ;;
  staging)
    # Update these values for staging environment
    CONTAINER_NAME="lighthouse-mysql-staging"
    DB_USER="${STAGING_DB_USER:-lighthouse_user}"
    DB_PASSWORD="${STAGING_DB_PASSWORD:-lighthouse_password}"
    DB_NAME="${STAGING_DB_NAME:-lighthouse_staging}"
    ;;
  production)
    # Production restore requires explicit confirmation
    echo -e "${RED}⚠️  WARNING: You are about to restore a PRODUCTION database!${NC}"
    echo -e "${RED}This will DELETE all current data and replace it with the backup.${NC}"
    echo -n "Type 'RESTORE PRODUCTION' to confirm: "
    read CONFIRMATION
    if [ "${CONFIRMATION}" != "RESTORE PRODUCTION" ]; then
      echo -e "${YELLOW}Restore cancelled${NC}"
      exit 0
    fi
    
    # Check for production credentials
    if [ -z "${PROD_DB_USER}" ] || [ -z "${PROD_DB_PASSWORD}" ]; then
      echo -e "${RED}Error: Production database credentials not set in environment variables${NC}"
      echo "Please set PROD_DB_USER and PROD_DB_PASSWORD environment variables"
      exit 1
    fi
    CONTAINER_NAME="lighthouse-mysql-production"
    DB_USER="${PROD_DB_USER}"
    DB_PASSWORD="${PROD_DB_PASSWORD}"
    DB_NAME="${PROD_DB_NAME:-lighthouse}"
    ;;
  *)
    echo -e "${RED}Error: Unknown environment '${ENVIRONMENT}'${NC}"
    echo "Usage: $0 <backup-file> [development|staging|production]"
    exit 1
    ;;
esac

# Check if container is running
if ! docker ps | grep -q ${CONTAINER_NAME}; then
  echo -e "${RED}Error: Container ${CONTAINER_NAME} is not running${NC}"
  exit 1
fi

# Create a timestamp for current backup (safety measure)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SAFETY_BACKUP="./backups/pre_restore_${ENVIRONMENT}_${TIMESTAMP}.sql"

# Create safety backup before restore
echo -e "${YELLOW}Creating safety backup before restore...${NC}"
mkdir -p ./backups
docker exec ${CONTAINER_NAME} mysqldump \
  -u ${DB_USER} \
  -p${DB_PASSWORD} \
  --single-transaction \
  --routines \
  --triggers \
  --add-drop-table \
  --create-options \
  --extended-insert \
  --lock-tables=false \
  ${DB_NAME} > ${SAFETY_BACKUP}

if [ $? -eq 0 ]; then
  gzip ${SAFETY_BACKUP}
  echo -e "${GREEN}✅ Safety backup created: ${SAFETY_BACKUP}.gz${NC}"
else
  echo -e "${RED}❌ Failed to create safety backup. Restore cancelled.${NC}"
  exit 1
fi

# Prepare the SQL file
TEMP_SQL="/tmp/restore_${TIMESTAMP}.sql"
if [[ ${BACKUP_FILE} == *.gz ]]; then
  echo -e "${YELLOW}Decompressing backup file...${NC}"
  gunzip -c ${BACKUP_FILE} > ${TEMP_SQL}
else
  cp ${BACKUP_FILE} ${TEMP_SQL}
fi

# Perform restore
echo -e "${YELLOW}Restoring database from backup...${NC}"
docker exec -i ${CONTAINER_NAME} mysql \
  -u ${DB_USER} \
  -p${DB_PASSWORD} \
  ${DB_NAME} < ${TEMP_SQL}

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Database restored successfully!${NC}"
  
  # Clean up temporary file
  rm -f ${TEMP_SQL}
  
  # Run Prisma migrations to ensure schema is up to date
  if [ "${ENVIRONMENT}" = "development" ]; then
    echo -e "${YELLOW}Running Prisma migrations...${NC}"
    npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Migrations applied successfully${NC}"
    else
      echo -e "${YELLOW}⚠️  Migration failed. You may need to run migrations manually.${NC}"
    fi
  fi
  
  # Verify restore
  echo -e "\n${YELLOW}Verifying restore...${NC}"
  TABLE_COUNT=$(docker exec ${CONTAINER_NAME} mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} -e "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='${DB_NAME}';" -s -N)
  echo -e "Tables in database: ${TABLE_COUNT}"
  
  # Show table list
  echo -e "\n${YELLOW}Database tables:${NC}"
  docker exec ${CONTAINER_NAME} mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} -e "SHOW TABLES;"
  
else
  echo -e "${RED}❌ Restore failed!${NC}"
  echo -e "${YELLOW}You can restore from the safety backup: ${SAFETY_BACKUP}.gz${NC}"
  rm -f ${TEMP_SQL}
  exit 1
fi

echo -e "\n${GREEN}Restore process completed!${NC}"
echo -e "${YELLOW}Safety backup kept at: ${SAFETY_BACKUP}.gz${NC}"