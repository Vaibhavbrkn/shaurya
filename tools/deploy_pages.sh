#!/usr/bin/env bash
# Publish Shaurya to GitHub Pages.
#
# Prerequisite (one time, needs a real terminal):
#   gh auth login --web -h github.com -p https -s repo
#
# Usage: tools/deploy_pages.sh [repo-name]
set -euo pipefail

REPO_NAME="${1:-shaurya}"
cd "$(dirname "$0")/.."

if ! gh auth status >/dev/null 2>&1; then
  echo "Not signed in. Run: gh auth login --web -h github.com -p https -s repo" >&2
  exit 1
fi

LOGIN=$(gh api user --jq .login)
NAME=$(gh api user --jq '.name // .login')
# Commit identity is passed per-command so the global git config is untouched.
EMAIL="${LOGIN}@users.noreply.github.com"
echo "account: $LOGIN"

git add -A
if git diff --cached --quiet; then
  echo "nothing new to commit"
else
  git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "$(cat <<'EOF'
Add Shaurya, a static Indian Armed Forces patriotic radio

A single page that shuffles 49 verified patriotic tracks as audio-only
YouTube streams, rotates quotes from war heroes and regimental mottos, and
cycles 25 freely-licensed armed forces photographs behind them.

The layout is photo-first on purpose: chrome is kept to a slim top bar and
player so the photograph stays the subject, and the player publishes its
measured height to CSS so nothing overlaps on phones.
EOF
)"
  echo "committed"
fi

if gh repo view "$LOGIN/$REPO_NAME" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || \
    git remote add origin "https://github.com/$LOGIN/$REPO_NAME.git"
  git push -u origin main
else
  gh repo create "$REPO_NAME" --public --source . --remote origin --push \
    --description "शौर्य — Indian Armed Forces patriotic radio. Audio-only, no login, no ads."
fi

# Serve straight from the branch: the site is plain static files and .nojekyll
# tells Pages not to run it through Jekyll.
gh api -X POST "repos/$LOGIN/$REPO_NAME/pages" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || gh api -X PUT "repos/$LOGIN/$REPO_NAME/pages" \
       -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || echo "note: Pages may already be configured" >&2

URL="https://${LOGIN}.github.io/${REPO_NAME}/"
echo
echo "Repo: https://github.com/$LOGIN/$REPO_NAME"
echo "Live: $URL   (first build takes ~1-2 minutes)"
