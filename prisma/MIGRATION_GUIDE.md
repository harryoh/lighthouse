# Database Migration Guide

## Overview

This guide provides instructions for managing database migrations using Prisma in the Lighthouse project.

## Prerequisites

- Docker and Docker Compose installed
- Node.js >= 20.0.0
- pnpm >= 8.0.0
- MySQL 8.0 running via Docker Compose

## Getting Started

### 1. Start Database Services

```bash
docker-compose -f docker/docker-compose.yml up -d
```

### 2. Apply Existing Migrations

```bash
npx prisma migrate deploy
```

### 3. Seed Database (Development Only)

```bash
npx prisma db seed
```

## Creating New Migrations

### 1. Modify Prisma Schema

Edit `prisma/schema.prisma` to add or modify models.

### 2. Create Migration

```bash
npx prisma migrate dev --name descriptive_migration_name
```

**Naming Conventions:**

- Use snake_case for migration names
- Be descriptive: `add_user_role_field`, `create_analytics_table`
- Include action and target: `remove_deprecated_columns`

### 3. Review Generated SQL

Check the generated migration file in `prisma/migrations/` before committing.

### 4. Test Migration

```bash
# Reset database and apply all migrations
npx prisma migrate reset

# Verify schema
npx prisma studio
```

## Team Collaboration

### Before Committing

1. **Test on Fresh Database**

   ```bash
   npx prisma migrate reset --force
   npx prisma db seed
   ```

2. **Run Tests**

   ```bash
   pnpm test
   ```

3. **Check for Conflicts**
   - Pull latest changes
   - Resolve any migration conflicts
   - Re-test if conflicts were resolved

### After Pulling Changes

```bash
# Apply new migrations
npx prisma migrate deploy

# Regenerate Prisma Client
npx prisma generate
```

## Production Migrations

### 1. Backup Database

```bash
# Create backup script
docker exec lighthouse-mysql mysqldump -u lighthouse_user -plighthouse_password lighthouse > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test Migration on Staging

Always test migrations on a staging environment first.

### 3. Apply Migration

```bash
# On production server
npx prisma migrate deploy
```

### 4. Verify Migration

- Check application logs
- Test critical functionality
- Monitor performance metrics

## Rollback Procedures

### Development Environment

```bash
# Reset to specific migration
npx prisma migrate reset --to migration_name

# Or completely reset
npx prisma migrate reset --force
```

### Production Environment

1. **Restore from Backup**

   ```bash
   docker exec -i lighthouse-mysql mysql -u lighthouse_user -plighthouse_password lighthouse < backup_file.sql
   ```

2. **Revert Code Changes**

   ```bash
   git revert <commit-hash>
   ```

3. **Monitor and Verify**
   - Check application functionality
   - Review error logs
   - Notify team

## Common Commands

| Command                     | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `npx prisma migrate dev`    | Create a new migration                           |
| `npx prisma migrate deploy` | Apply pending migrations                         |
| `npx prisma migrate reset`  | Reset database and reapply all migrations        |
| `npx prisma migrate status` | Check migration status                           |
| `npx prisma db push`        | Push schema changes without migration (dev only) |
| `npx prisma db seed`        | Run seed script                                  |
| `npx prisma studio`         | Open Prisma Studio GUI                           |
| `npx prisma generate`       | Regenerate Prisma Client                         |

## Troubleshooting

### Migration Fails

1. Check database connection
2. Verify user permissions
3. Review migration SQL for errors
4. Check for conflicting migrations

### Schema Drift

```bash
# Check for drift
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# Reset if needed
npx prisma migrate reset --force
```

### Connection Issues

1. Verify Docker containers are running: `docker-compose ps`
2. Check environment variables in `.env`
3. Test connection: `npx prisma db pull`

## Best Practices

1. **Always test migrations locally first**
2. **Keep migrations small and focused**
3. **Never modify existing migration files**
4. **Document breaking changes in migration comments**
5. **Backup production database before migrations**
6. **Use transactions for complex migrations**
7. **Monitor performance after migrations**

## GitHub Actions Workflow

The project includes automated migration validation:

```yaml
# .github/workflows/migration-check.yml
name: Migration Check
on: [push, pull_request]
jobs:
  test-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Database
        run: docker-compose -f docker/docker-compose.yml up -d
      - name: Apply Migrations
        run: npx prisma migrate deploy
      - name: Run Tests
        run: pnpm test
```

## Support

For migration issues or questions:

1. Check this guide first
2. Review Prisma documentation: https://www.prisma.io/docs
3. Contact the development team

## Migration History

| Date       | Migration | Description                              |
| ---------- | --------- | ---------------------------------------- |
| 2025-08-18 | init      | Initial database schema with core tables |
