#!/bin/bash
# Deploy ryaneko-license to VPS
# Usage: ./deploy.sh

set -euo pipefail

VPS_HOST="root@43.157.213.188"
APP_DIR="/var/www/ryaneko-license"
PM2_NAME="license"

echo "🚀 Deploying ryaneko-license..."

# Step 1: Push an already-reviewed commit to GitHub
echo "📦 Pushing to GitHub..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree masih memiliki perubahan. Commit dan verifikasi terlebih dahulu."
  exit 1
fi
git push origin main

# Step 2: Deploy on VPS
echo "🔄 Deploying on VPS..."
ssh "$VPS_HOST" << EOF
  set -euo pipefail
  cd "$APP_DIR"
  git pull --ff-only origin main
  npm ci --include=dev
  npm run build
  pm2 restart "$PM2_NAME"
  for attempt in \$(seq 1 30); do
    if curl --fail --silent --output /dev/null http://127.0.0.1:3003/admin/raw-file-copy; then
      echo "✅ Health check berhasil"
      exit 0
    fi
    sleep 1
  done
  pm2 logs "$PM2_NAME" --lines 50 --nostream
  exit 1
EOF

echo ""
echo "✅ Done! Check: https://license.ryanekoapp.web.id"
