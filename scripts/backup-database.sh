#!/bin/bash

# Lighthouse Database Backup Script
# Usage: ./scripts/backup-database.sh [environment]
# Example: ./scripts/backup-database.sh production

set -e

# Configuration
ENVIRONMENT=${1:-development}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/lighthouse_${ENVIRONMENT}_${TIMESTAMP}.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

echo -e "${YELLOW}Starting database backup for ${ENVIRONMENT} environment...${NC}"

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
    # Update these values for production environment
    # NEVER hardcode production credentials here
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
    echo "Usage: $0 [development|staging|production]"
    exit 1
    ;;
esac

# Check if container is running
if ! docker ps | grep -q ${CONTAINER_NAME}; then
  echo -e "${RED}Error: Container ${CONTAINER_NAME} is not running${NC}"
  exit 1
fi

# Perform backup
echo -e "${YELLOW}Creating backup...${NC}"
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
  ${DB_NAME} > ${BACKUP_FILE}

# Check if backup was successful
if [ $? -eq 0 ]; then
  # Compress the backup
  gzip ${BACKUP_FILE}
  BACKUP_FILE="${BACKUP_FILE}.gz"
  
  # Get file size
  FILE_SIZE=$(ls -lh ${BACKUP_FILE} | awk '{print $5}')
  
  echo -e "${GREEN}✅ Backup completed successfully!${NC}"
  echo -e "Backup file: ${BACKUP_FILE}"
  echo -e "File size: ${FILE_SIZE}"
  
  # Clean up old backups (keep last 7 days for development, 30 days for others)
  if [ "${ENVIRONMENT}" = "development" ]; then
    DAYS_TO_KEEP=7
  else
    DAYS_TO_KEEP=30
  fi
  
  echo -e "${YELLOW}Cleaning up backups older than ${DAYS_TO_KEEP} days...${NC}"
  find ${BACKUP_DIR} -name "lighthouse_${ENVIRONMENT}_*.sql.gz" -mtime +${DAYS_TO_KEEP} -delete
  
  # List recent backups
  echo -e "\n${YELLOW}Recent backups:${NC}"
  ls -lht ${BACKUP_DIR}/lighthouse_${ENVIRONMENT}_*.sql.gz 2>/dev/null | head -5 || echo "No backups found"
  
else
  echo -e "${RED}❌ Backup failed!${NC}"
  rm -f ${BACKUP_FILE}
  exit 1
fi

# Verify backup integrity (optional)
echo -e "\n${YELLOW}Verifying backup integrity...${NC}"
if gunzip -t ${BACKUP_FILE} 2>/dev/null; then
  echo -e "${GREEN}✅ Backup file integrity verified${NC}"
else
  echo -e "${RED}❌ Backup file appears to be corrupted${NC}"
  exit 1
fi

echo -e "\n${GREEN}Backup process completed!${NC}"