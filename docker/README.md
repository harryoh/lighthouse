# Docker Infrastructure for Lighthouse

## Services

- **MySQL 8.0** - Main database (port 3306)
- **Redis 7** - Cache and job queue (port 6379)
- **LocalStack** - AWS services emulation (port 4566)

## Quick Start

### Start Services

```bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Check service status
docker-compose -f docker/docker-compose.yml ps

# View logs
docker-compose -f docker/docker-compose.yml logs -f
```

### Stop Services

```bash
# Stop all services
docker-compose -f docker/docker-compose.yml down

# Stop and remove volumes (clean reset)
docker-compose -f docker/docker-compose.yml down -v
```

### Initialize LocalStack Services

After starting the services, initialize LocalStack:

```bash
# Install AWS CLI if not already installed
brew install awscli

# Run initialization script
docker exec lighthouse-localstack /docker-entrypoint-initaws.d/init-localstack.sh
```

## Service Details

### MySQL

- Host: localhost
- Port: 3306
- Database: lighthouse
- User: lighthouse_user
- Password: lighthouse_password
- Root Password: lighthouse_root_password

### Redis

- Host: localhost
- Port: 6379
- No authentication (development only)
- Memory limit: 256MB
- Persistence: AOF enabled

### LocalStack

- Endpoint: http://localhost:4566
- Services: S3, SQS, SNS, DynamoDB
- Access Key: test
- Secret Key: test
- Region: us-east-1

## Connection Examples

### MySQL Connection String

```
mysql://lighthouse_user:lighthouse_password@localhost:3306/lighthouse
```

### Redis Connection

```
redis://localhost:6379
```

### AWS SDK Configuration

```javascript
const AWS = require('aws-sdk');

AWS.config.update({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  accessKeyId: 'test',
  secretAccessKey: 'test',
});
```

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

```bash
# Check what's using the port (example for MySQL)
lsof -i :3306

# Kill the process if needed
kill -9 <PID>
```

### Service Won't Start

Check the logs for specific service:

```bash
docker-compose -f docker/docker-compose.yml logs mysql
docker-compose -f docker/docker-compose.yml logs redis
docker-compose -f docker/docker-compose.yml logs localstack
```

### Reset Everything

If you need a clean start:

```bash
docker-compose -f docker/docker-compose.yml down -v
docker system prune -a --volumes
```
