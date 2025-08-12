#!/bin/bash
# init-localstack.sh: Initialize LocalStack services for Lighthouse

set -e

echo "Initializing LocalStack services..."

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3":"available"'; do
    echo "Waiting for LocalStack services..."
    sleep 2
done

echo "LocalStack is ready. Initializing services..."

# Create S3 buckets for content storage
echo "Creating S3 buckets..."
aws --endpoint-url=http://localhost:4566 s3 mb s3://lighthouse-content || true
aws --endpoint-url=http://localhost:4566 s3 mb s3://lighthouse-backups || true
aws --endpoint-url=http://localhost:4566 s3 mb s3://lighthouse-logs || true

# Set bucket policies for public read on content bucket (if needed)
cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::lighthouse-content/*"
        }
    ]
}
EOF

aws --endpoint-url=http://localhost:4566 s3api put-bucket-policy \
    --bucket lighthouse-content \
    --policy file:///tmp/bucket-policy.json || true

# Create SQS queues for job processing
echo "Creating SQS queues..."
aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name lighthouse-crawl-queue \
    --attributes VisibilityTimeout=300,MessageRetentionPeriod=1209600 || true

aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name lighthouse-analysis-queue \
    --attributes VisibilityTimeout=600,MessageRetentionPeriod=1209600 || true

aws --endpoint-url=http://localhost:4566 sqs create-queue \
    --queue-name lighthouse-dlq \
    --attributes MessageRetentionPeriod=1209600 || true

# Create SNS topics for notifications
echo "Creating SNS topics..."
aws --endpoint-url=http://localhost:4566 sns create-topic \
    --name lighthouse-alerts || true

aws --endpoint-url=http://localhost:4566 sns create-topic \
    --name lighthouse-notifications || true

# Create DynamoDB tables for session management (optional)
echo "Creating DynamoDB tables..."
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
    --table-name lighthouse-sessions \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    2>/dev/null || true

# List created resources for verification
echo ""
echo "=== Created Resources ==="
echo "S3 Buckets:"
aws --endpoint-url=http://localhost:4566 s3 ls

echo ""
echo "SQS Queues:"
aws --endpoint-url=http://localhost:4566 sqs list-queues

echo ""
echo "SNS Topics:"
aws --endpoint-url=http://localhost:4566 sns list-topics

echo ""
echo "DynamoDB Tables:"
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

echo ""
echo "LocalStack initialization complete!"