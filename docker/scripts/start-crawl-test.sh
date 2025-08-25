#!/bin/bash

# ===============================================
# Lighthouse Crawl Test Environment Startup Script
# ===============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "================================================"
echo "   Lighthouse Crawl Test Environment Setup"
echo "================================================"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Step 1: Check Docker is running
print_status "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Step 2: Start Docker services
print_status "Starting Docker services (MySQL, Redis, LocalStack)..."
cd docker
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be ready..."

# Check MySQL
echo -n "  MySQL: "
for i in {1..30}; do
    if docker-compose exec -T mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo "Ready ✓"
        break
    fi
    echo -n "."
    sleep 2
done

# Check Redis
echo -n "  Redis: "
for i in {1..15}; do
    if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "Ready ✓"
        break
    fi
    echo -n "."
    sleep 1
done

# Check LocalStack
echo -n "  LocalStack: "
for i in {1..20}; do
    if curl -s http://localhost:4567/_localstack/health | grep -q "running"; then
        echo "Ready ✓"
        break
    fi
    echo -n "."
    sleep 2
done

cd "$PROJECT_ROOT"

# Step 3: Check and install dependencies
print_status "Checking Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Running pnpm install..."
    pnpm install
else
    print_status "Dependencies already installed"
fi

# Step 4: Build the project
print_status "Building project..."
pnpm nx run-many --target=build --projects=database,crawler-core --skip-nx-cache

# Step 5: Run database migrations
print_status "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || {
    print_warning "Migrations may already be applied or pending. Running migrate dev..."
    npx prisma migrate dev --name init
}

# Step 6: Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate

# Step 7: Create test environment file if not exists
if [ ! -f ".env.test" ]; then
    print_status "Creating test environment file..."
    cat > .env.test << EOF
# Test Environment Configuration
DATABASE_URL="mysql://root:pass@localhost:3307/lighthouse"
REDIS_URL="redis://localhost:6380"
REDIS_HOST="localhost"
REDIS_PORT="6380"
NODE_ENV="test"
PORT="3001"
CRAWLER_USER_AGENT="Mozilla/5.0 (compatible; LighthouseTest/1.0)"
CRAWLER_CONCURRENT_REQUESTS="3"
CRAWLER_REQUEST_DELAY="1000"
EOF
fi

# Step 8: Start API server in background
print_status "Starting API server..."
export NODE_ENV=test
export DATABASE_URL="mysql://root:pass@localhost:3307/lighthouse"
export REDIS_HOST="localhost"
export REDIS_PORT="6380"

# Kill any existing API server on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start API server in background
nohup pnpm nx serve api > logs/api-test.log 2>&1 &
API_PID=$!

# Wait for API server to be ready
print_status "Waiting for API server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3001/health 2>/dev/null; then
        print_status "API server is ready (PID: $API_PID)"
        break
    fi
    echo -n "."
    sleep 2
done

# Step 9: Display status
echo ""
echo "================================================"
echo "   Test Environment Status"
echo "================================================"
print_status "MySQL:      http://localhost:3307"
print_status "Redis:      http://localhost:6380"
print_status "RedisInsight: http://localhost:8002"
print_status "LocalStack: http://localhost:4567"
print_status "API Server: http://localhost:3001"
print_status "Bull Board: http://localhost:3001/admin/queues"
echo ""

# Step 10: Run the crawl test
print_status "Ready to run crawl tests!"
echo ""
echo "To run the Korean news crawl test:"
echo "  npx ts-node test/crawl-samples/korean-news-test.ts"
echo ""
echo "To test with curl:"
echo "  # Test crawler endpoint:"
echo "  curl -X POST http://localhost:3001/api/crawl/test"
echo ""
echo "  # Create a scheduled job:"
echo '  curl -X POST http://localhost:3001/api/schedules \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"test-schedule-1\",
      \"name\": \"Test Schedule\",
      \"cronExpression\": \"0 */6 * * *\",
      \"data\": {
        \"sourceId\": \"test-source\",
        \"source\": {
          \"url\": \"https://news.naver.com\",
          \"type\": \"NEWS\",
          \"name\": \"Naver News\"
        }
      }
    }"'
echo ""
echo "To stop the test environment:"
echo "  kill $API_PID  # Stop API server"
echo "  cd docker && docker-compose down"
echo ""
echo "================================================"

# Keep script running (optional - remove if you want it to exit)
# tail -f logs/api-test.log