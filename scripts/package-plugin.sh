#!/usr/bin/env bash
# Package the members-portal WordPress plugin for upload (Plugins → Add New → Upload Plugin).
#
#   bash scripts/package-plugin.sh        # writes dist/brothers-151-members-<version>.zip
#
# Leaves out tests and developer files; gives files web permissions (644/755) — 600 caused a 403 on 2026-10-30.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SRC="$ROOT/wordpress/plugins/brothers-151-members"
step() { printf '\n==> %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

[ -f "$SRC/brothers-151-members.php" ] || fail "Plugin not found at $SRC"
VERSION="$(sed -n 's/^ \* Version: *//p' "$SRC/brothers-151-members.php" | head -1 | tr -d '[:space:]')"
[ -n "$VERSION" ] || fail "Could not read the plugin version."
ZIP="$ROOT/dist/brothers-151-members-$VERSION.zip"

step "Branch: $(git rev-parse --abbrev-ref HEAD)  ($(git log --oneline -1))"

if command -v php >/dev/null 2>&1; then
  step "Checking PHP syntax"
  find "$SRC" -name '*.php' -not -path '*/tests/*' -print0 | while IFS= read -r -d '' f; do
    php -l "$f" >/dev/null || fail "PHP syntax error in $f"
  done
  echo "OK"
fi

step "Copying plugin files (no tests or developer files)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/brothers-151-members"
( cd "$SRC" && tar cf - --exclude='./tests' --exclude='./phpunit.xml.dist' --exclude='./.gitignore' \
    --exclude='./.phpunit.result.cache' --exclude='*.map' . ) | ( cd "$TMP/brothers-151-members" && tar xf - )
[ -f "$TMP/brothers-151-members/vendor/firebase/php-jwt/src/JWT.php" ] || fail "Bundled php-jwt is missing."
find "$TMP" -type d -exec chmod 755 {} +
find "$TMP" -type f -exec chmod 644 {} +

step "Creating $ZIP"
mkdir -p "$ROOT/dist"
rm -f "$ZIP"
( cd "$TMP" && zip -qrX "$ZIP" brothers-151-members )
[ -s "$ZIP" ] || fail "The zip was not created."
zipinfo -1 "$ZIP" | grep -q '^brothers-151-members/tests/' && fail "Tests ended up in the zip."

step "Done"
ls -lh "$ZIP"
echo "Upload it in wp-admin: Plugins → Add New Plugin → Upload Plugin (staging first)."
echo "Steps and checks: docs/members-portal/DEPLOYMENT.md"
