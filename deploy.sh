#!/bin/bash
# x402 API Server — Fly.io Deployment Script
#
# Usage:
#   ./deploy.sh              # Deploy (assumes fly app already created)
#   ./deploy.sh init         # First-time setup: create app + set secrets
#
# Prerequisites:
#   curl -L https://fly.io/install.sh | sh
#   fly auth login

set -euo pipefail

PAY_TO="0x60264c480b67adb557efEd22Cf0e7ceA792DefB7"

if [ "${1:-}" = "init" ]; then
  echo "🚀 Initializing Fly.io app..."
  fly launch --no-deploy --name x402-api --region nrt
  
  echo "🔑 Setting secrets..."
  fly secrets set \
    PAY_TO_ADDRESS="$PAY_TO" \
    BASE_RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
  
  echo "📦 Deploying..."
  fly deploy
  
  echo ""
  echo "✅ Deployed! Your API is live at:"
  fly status | grep Hostname
else
  echo "📦 Deploying to Fly.io..."
  fly deploy
  echo "✅ Deployed!"
fi
