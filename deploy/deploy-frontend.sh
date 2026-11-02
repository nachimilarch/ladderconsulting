#!/usr/bin/env bash
# Build the frontend on THIS machine and publish it to the EC2 server, with a backup of the live build.
#
# Why not "git pull && npm run build" on the server: the server has only ~2 GB of RAM and its git history is
# not the same as GitHub's, so a pull conflicts with files edited there. Building here also lets the public
# website pages be pre-rendered (see frontend/scripts/prerender.mjs), which is too heavy for the server.
#
# Usage (from the repo root, with ladder-key.pem next to it):  bash deploy/deploy-frontend.sh
# The VITE_* values are read from the server's frontend/.env at run time, so nothing secret is stored here.
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@13.203.48.124}"
KEY="${DEPLOY_KEY:-ladder-key.pem}"
APP="/var/www/ladderstep/frontend"
STAMP="$(date +%Y%m%d-%H%M)"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=10)

cd "$(dirname "$0")/../frontend"

echo "1/5 Reading VITE_* settings from the server"
"${SSH[@]}" "$HOST" "grep '^VITE_' $APP/.env" > .env.deploy
trap 'rm -f .env.deploy' EXIT

echo "2/5 Building (with the public pages pre-rendered)"
cp .env.deploy .env.production.local
trap 'rm -f .env.deploy .env.production.local' EXIT
npm ci --no-audit --no-fund
npm run build
test -f dist/index.html && test -f dist/about/index.html

echo "3/5 Uploading"
tar czf /tmp/ladder-dist.tgz dist
scp -i "$KEY" -o BatchMode=yes /tmp/ladder-dist.tgz "$HOST:/tmp/ladder-dist.tgz"

echo "4/5 Swapping in the new build (old one is kept as dist.bak-$STAMP)"
"${SSH[@]}" "$HOST" "set -e; cd $APP; rm -rf /tmp/newdist; mkdir /tmp/newdist; tar xzf /tmp/ladder-dist.tgz -C /tmp/newdist; test -f /tmp/newdist/dist/index.html; mv dist dist.bak-$STAMP; mv /tmp/newdist/dist dist"

echo "5/5 Checking the live site"
for p in / /about/ /login; do printf '%s -> ' "$p"; curl -sSL -o /dev/null -w '%{http_code}\n' "https://theladderconsulting.com$p"; done
echo "Done. To roll back: ssh in, then  cd $APP && mv dist dist.bad && mv dist.bak-$STAMP dist"
