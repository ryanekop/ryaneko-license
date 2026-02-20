#!/bin/bash
# Deploy ryaneko-license to VPS
# Usage: ./deploy.sh

set -e

VPS_HOST="root@103.175.207.113"
APP_DIR="/root/ryaneko-license"
PM2_NAME="license"

echo "🚀 Deploying ryaneko-license..."

# Step 1: Push to GitHub
echo "📦 Pushing to GitHub..."
git add -A
git commit -m "fix: update email template image URLs to self-hosted" 2>/dev/null || echo "Nothing to commit"
git push origin main

# Step 2: Deploy on VPS
echo "🔄 Deploying on VPS..."
ssh $VPS_HOST << 'EOF'
  cd /root/ryaneko-license
  git pull origin main
  npm install --production
  npm run build
  pm2 restart license
  echo "✅ Deploy complete!"
EOF

echo ""
echo "✅ Done! Check: https://license.ryanekoapp.web.id"
