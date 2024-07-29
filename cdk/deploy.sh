#!/bin/bash

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 {frame|backend} {test|main}"
    exit 1
fi

DEPLOY_TARGET=$1
ENVIRONMENT=$2

ECR_BASE="726394863183.dkr.ecr.ap-northeast-1.amazonaws.com"

if [ "$ENVIRONMENT" = "test" ]; then
    FRAME_IMAGE="test-card-frame:latest"
    BACKEND_IMAGE="test-card:latest"
elif [ "$ENVIRONMENT" = "main" ]; then
    FRAME_IMAGE="main-card-frame:latest"
    BACKEND_IMAGE="main-card:latest"
else
    echo "Invalid environment: $ENVIRONMENT. Use 'test' or 'main'."
    exit 1
fi

echo "Logging in to AWS ECR..."
aws ecr get-login-password --region ap-northeast-1 --profile senspace | docker login --username AWS --password-stdin $ECR_BASE

if [ "$DEPLOY_TARGET" = "frame" ]; then
    echo "Starting Frame deployment..."
    docker build -t card-frame:latest -f ../frame/Dockerfile ../frame
    docker tag card-frame:latest $ECR_BASE/$FRAME_IMAGE
    docker push $ECR_BASE/$FRAME_IMAGE
    echo "Frame deployment to $ENVIRONMENT completed."

# Backend deploy
elif [ "$DEPLOY_TARGET" = "backend" ]; then
    echo "Starting Backend deployment..."
    docker build -t card-backend:latest -f ../backend/Dockerfile.test ../backend
    docker tag card-backend:latest $ECR_BASE/$BACKEND_IMAGE
    docker push $ECR_BASE/$BACKEND_IMAGE
    echo "Backend deployment to $ENVIRONMENT completed."

else
    echo "Invalid deployment target: $DEPLOY_TARGET. Use 'frontend' or 'backend'."
    exit 1
fi