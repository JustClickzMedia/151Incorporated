#!/usr/bin/env bash
# Read-only checks of the members-portal plugin on a WordPress site (staging first). Signed-out requests only,
# one request per check: safe to run against staging or production. Nothing is created or changed.
#
#   bash scripts/portal-smoke-test.sh https://tzin.brothersof1-5-1.org/staging/1848
#   bash scripts/portal-smoke-test.sh https://tzin.brothersof1-5-1.org            # production, after go-live
#   bash scripts/portal-smoke-test.sh <url> --member   # also sign in once with a TEST member account (asks for it)
set -uo pipefail

WP="${1:-}"; WP="${WP%/}"
FRONT="${FRONTEND_ORIGIN:-https://brothersof1-5-1.org}"
[ -n "$WP" ] || { echo "Usage: bash scripts/portal-smoke-test.sh <wordpress base url>"; exit 2; }

PASS=0; FAIL=0
TMPH="$(mktemp)"; TMPB="$(mktemp)"; trap 'rm -f "$TMPH" "$TMPB"' EXIT
ok()   { PASS=$((PASS+1)); printf '  PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL  %s\n        %s\n' "$1" "$2"; }
req()  { curl -sS -o "$TMPB" -D "$TMPH" -w '%{http_code}' --max-time 20 "$@"; }
hdr()  { grep -i "^$1:" "$TMPH" | tail -1 | cut -d' ' -f2- | tr -d '\r'; }
body() { cat "$TMPB"; }
gql()  { req -X POST "$WP/graphql" -H 'Content-Type: application/json' -H "Origin: $FRONT" --data "{\"query\":\"$1\"}"; }

echo "Members portal smoke test: $WP  (front end $FRONT)"

echo; echo "Session API"
code=$(req "$WP/wp-json/b151/v1/session" -H "Origin: $FRONT")
[ "$code" = 200 ] && body | grep -q '"authenticated":false' && ok "GET /session signed out → authenticated:false" || bad "GET /session signed out" "HTTP $code $(body | head -c 200)"
hdr cache-control | grep -q 'no-store' && ok "session response is not cacheable" || bad "session Cache-Control" "got: $(hdr cache-control)"
[ "$(hdr access-control-allow-origin)" = "$FRONT" ] && ok "CORS allows the front end" || bad "CORS Allow-Origin" "got: $(hdr access-control-allow-origin)"
[ "$(hdr access-control-allow-credentials)" = "true" ] && ok "CORS allows credentials for the front end" || bad "CORS Allow-Credentials" "got: $(hdr access-control-allow-credentials)"

code=$(req "$WP/wp-json/b151/v1/session" -H "Origin: https://evil.example")
[ "$code" = 403 ] && ok "foreign origin refused (403)" || bad "foreign origin" "HTTP $code"
[ -z "$(hdr access-control-allow-credentials)" ] && ok "no credentials header for a foreign origin" || bad "foreign origin credentials" "got: $(hdr access-control-allow-credentials)"

code=$(req "$WP/wp-json/b151/v1/oauth/providers")
[ "$code" = 200 ] && ok "OAuth providers list answers ($(body | head -c 120))" || bad "OAuth providers" "HTTP $code"

code=$(req "$WP/wp-json/b151/v1/resources/1/download" -H "Origin: $FRONT")
[ "$code" = 401 ] && ok "downloads need sign-in (401)" || bad "download signed out" "HTTP $code"

echo; echo "GraphQL (signed out)"
code=$(gql '{ currentMember { id } }')
body | grep -q '"currentMember":null' && ok "currentMember is null" || bad "currentMember signed out" "HTTP $code $(body | head -c 200)"
code=$(gql '{ memberEvents { total } memberResources { total } memberAnnouncements { total } }')
body | grep -q '"memberEvents":{"total":0}' && body | grep -q '"memberResources":{"total":0}' && ok "member content empty for guests" || bad "member content signed out" "$(body | head -c 200)"
code=$(gql '{ memberDirectory { total } }')
body | grep -q '"total":0' && ok "directory empty for guests" || bad "directory signed out" "$(body | head -c 200)"
code=$(gql '{ posts(first:1) { nodes { title } } }')
body | grep -q '"posts"' && ! body | grep -q '"errors"' && ok "public content still works" || bad "public posts query" "$(body | head -c 200)"

echo; echo "Hardening"
for t in b151_member_event b151_announcement b151_resource new-prospects brothers; do
  code=$(req "$WP/wp-json/wp/v2/$t")
  [ "$code" = 404 ] && ok "/wp/v2/$t not public" || bad "/wp/v2/$t" "HTTP $code"
done
code=$(req "$WP/wp-json/simple-jwt-login/v1/auth")
[ "$code" = 404 ] && ok "JWT password endpoint removed" || bad "JWT password endpoint" "HTTP $code"
code=$(req -X POST "$WP/xmlrpc.php" -H 'Content-Type: text/xml' --data '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>')
! body | grep -q 'wp.getUsersBlogs' && ok "XML-RPC methods off" || bad "XML-RPC" "methods still listed"
# A "coming soon" page (staging) answers 200 for everything; what matters is that nothing is revealed.
code=$(req "$WP/?author=1")
! hdr location | grep -q '/author/' && ok "?author=1 does not reveal a username" || bad "author scan" "HTTP $code $(hdr location)"
code=$(req "$WP/wp-sitemap.xml")
! body | grep -q '<urlset\|<sitemapindex' && ok "backend sitemap off" || bad "wp-sitemap.xml" "HTTP $code: sitemap XML returned"
code=$(req "$WP/")
hdr x-robots-tag | grep -qi noindex && ok "backend marked noindex" || bad "X-Robots-Tag" "got: $(hdr x-robots-tag)"

if [ "${2:-}" = "--member" ]; then
  echo; echo "Signed in as a TEST member account (one sign-in; type the password yourself, it is not shown or saved)"
  read -r -p "  Test member email: " M_EMAIL
  read -r -s -p "  Test member password: " M_PASS; echo
  JAR="$(mktemp)"; trap 'rm -f "$TMPH" "$TMPB" "$JAR"' EXIT
  jesc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
  PAYLOAD=$(printf '{"username":"%s","password":"%s"}' "$(jesc "$M_EMAIL")" "$(jesc "$M_PASS")")
  code=$(req -c "$JAR" -X POST "$WP/wp-json/b151/v1/session" -H "Origin: $FRONT" -H 'Content-Type: application/json' --data "$PAYLOAD")
  unset M_PASS PAYLOAD
  NONCE=$(body | sed -n 's/.*"nonce":"\([^"]*\)".*/\1/p')
  [ "$code" = 201 ] && [ -n "$NONCE" ] && ok "sign-in works and returns a nonce" || bad "sign-in" "HTTP $code $(body | head -c 160)"
  body | grep -q '"token"' && bad "sign-in response" "contains a token" || ok "no token in the sign-in response"
  grep -q 'wordpress_logged_in' "$JAR" && ok "session cookie set" || bad "session cookie" "no wordpress_logged_in cookie"
  grep -i '^set-cookie:.*wordpress_logged_in' "$TMPH" | grep -qi 'httponly' && ok "cookie is HttpOnly" || bad "cookie flags" "$(grep -i '^set-cookie:.*logged_in' "$TMPH" | head -1)"
  case "$WP" in https://*) grep -i '^set-cookie:.*wordpress_logged_in' "$TMPH" | grep -qi 'secure' && ok "cookie is Secure" || bad "cookie flags" "not Secure";; esac
  code=$(req -b "$JAR" -X POST "$WP/graphql" -H 'Content-Type: application/json' -H "Origin: $FRONT" -H "X-WP-Nonce: $NONCE" --data '{"query":"{ currentMember { displayName membershipNumber } }"}')
  body | grep -q '"membershipNumber"' && ! body | grep -q '"currentMember":null' && ok "GraphQL with cookie + nonce knows the member" || bad "GraphQL signed in" "$(body | head -c 200)"
  hdr cache-control | grep -q 'no-store' && ok "signed-in GraphQL is not cacheable (host max-age overridden)" || bad "signed-in GraphQL Cache-Control" "got: $(hdr cache-control)"
  code=$(req -b "$JAR" -X POST "$WP/graphql" -H 'Content-Type: application/json' -H "Origin: $FRONT" --data '{"query":"{ currentMember { id } }"}')
  body | grep -q '"currentMember":null' && ok "cookie without nonce is treated as a guest (CSRF protection)" || bad "cookie without nonce" "$(body | head -c 200)"
  code=$(req -b "$JAR" "$WP/wp-admin/")
  hdr location | grep -q '/members' && ok "member is sent away from wp-admin" || bad "wp-admin gate" "HTTP $code $(hdr location)"
  code=$(req -b "$JAR" -c "$JAR" -X DELETE "$WP/wp-json/b151/v1/session" -H "Origin: $FRONT" -H "X-WP-Nonce: $NONCE")
  code=$(req -b "$JAR" "$WP/wp-json/b151/v1/session" -H "Origin: $FRONT")
  body | grep -q '"authenticated":false' && ok "sign-out ends the session" || bad "sign-out" "$(body | head -c 160)"
fi

echo; echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
