#!/bin/sh
# Runs from the nginx image's /docker-entrypoint.d before nginx starts. Writes the snippet that
# infra/nginx.conf includes: empty on a normal instance; on a public demo (DEMO_MODE=on) it tells
# search engines to stay away (X-Robots-Tag on every answer, robots.txt disallowing everything).
set -eu
snippet=/etc/nginx/conf.d/demo.inc
if [ "${DEMO_MODE:-off}" = "on" ]; then
  cat > "$snippet" <<'NGINX'
add_header X-Robots-Tag "noindex, nofollow" always;
location = /robots.txt {
  default_type text/plain;
  return 200 "User-agent: *\nDisallow: /\n";
}
NGINX
  echo "corkspace: demo mode on (noindex, robots.txt disallow)"
else
  : > "$snippet"
fi
