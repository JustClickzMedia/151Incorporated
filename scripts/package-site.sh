#!/usr/bin/env bash
# Build the Angular site for production and package it for upload to HostGator (public_html).
#
#   bash scripts/package-site.sh               # build, then make dist/151-site.zip
#   bash scripts/package-site.sh --skip-build  # only re-make the zip from the existing build
#
# The zip is written inside the project (dist/151-site.zip), not to the Desktop: macOS can block
# Terminal from writing to ~/Desktop (Privacy & Security), which made earlier zips silently missing.
# Files get web permissions (644 files / 755 folders); 600 permissions caused the 403 error on 2026-10-30.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/dist/brotherof151/browser"
ZIP="$ROOT/dist/151-site.zip"

step() { printf '\n==> %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

if [ "${1:-}" != "--skip-build" ]; then
  step "Branch: $(git rev-parse --abbrev-ref HEAD)  ($(git log --oneline -1))"
  step "Installing dependencies (npm ci)"
  npm ci
  step "Building for production"
  npx ng build --configuration production
fi

step "Checking the build"
[ -f "$OUT/index.html" ] || fail "No build found at $OUT. Run without --skip-build."
[ -f "$OUT/index.csr.html" ] || fail "index.csr.html is missing from the build."
ls "$OUT"/main-*.js >/dev/null 2>&1 || fail "main-*.js is missing from the build."
grep -q 'useGraphql:' "$OUT"/main-*.js || fail "Could not find the GraphQL setting in main-*.js."
echo "OK: $(ls "$OUT" | tr '\n' ' ')"

step "Preparing files with web permissions"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$OUT"/. "$TMP"/
find "$TMP" -name '*.map' -delete
find "$TMP" -type d -exec chmod 755 {} +
find "$TMP" -type f -exec chmod 644 {} +

step "Creating $ZIP"
rm -f "$ZIP"
( cd "$TMP" && zip -qrX "$ZIP" . )
[ -s "$ZIP" ] || fail "The zip was not created."

step "Done"
ls -lh "$ZIP"
echo "Entries: $(zipinfo -1 "$ZIP" | wc -l | tr -d ' ')"
echo "Upload this file to public_html in cPanel File Manager, then Extract it there."
echo "To open the folder in Finder:  open \"$ROOT/dist\""
