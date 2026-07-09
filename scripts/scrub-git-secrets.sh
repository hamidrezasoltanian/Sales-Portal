#!/bin/bash
# Purge known leaked secrets from git history.
# WARNING: Rewrites history — all clones must re-fetch. Coordinate with team first.
set -euo pipefail

echo "=== Git history scrub (manual) ==="
echo "Install: pip install git-filter-repo  OR  brew install git-filter-repo"
echo ""
echo "Example (run from repo root AFTER backup):"
echo ""
cat <<'EOF'
git filter-repo --replace-text <(cat <<'REPL'
62604193==>***REMOVED***
adminS@2==>***REMOVED***
regex:192\.168\.4\.4==>***REMOVED***
REPL
) --force

git push origin --force --all
git push origin --force --tags
EOF
echo ""
echo "Then rotate all affected credentials on live systems."
