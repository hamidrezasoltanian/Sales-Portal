#!/bin/bash
# Build Vue 3 frontend → public/dist/
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
echo "[build-frontend] done → public/dist/"
