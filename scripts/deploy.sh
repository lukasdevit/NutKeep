#!/bin/bash
# deploy.sh — Pull latest code and redeploy Docker stack
set -e

cd /home/kukasz/NutKeep

echo "📥 Pulling latest changes..."
git pull origin main

echo "🐳 Rebuilding & restarting containers..."
sg docker -c "DOMAIN=app.nutkeep.com docker compose up -d --build --remove-orphans"

echo "🧹 Cleaning up old images..."
sg docker -c "docker image prune -f"

echo "✅ Deploy complete — https://app.nutkeep.com"
