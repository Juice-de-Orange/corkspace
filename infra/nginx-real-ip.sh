#!/bin/sh
# Runs at container start (nginx image entrypoint, /docker-entrypoint.d). Writes the realip settings
# that let nginx see the client address behind a reverse proxy or tunnel; nginx then passes it to
# the api as X-Real-IP, which keys the sign-in rate limit.
#
#   TRUSTED_PROXIES  addresses/CIDRs allowed to tell nginx the client address (space or comma
#                    separated); default: loopback and the private ranges, where a proxy on the same
#                    host or a tunnel container connects from. "none" trusts nobody.
#   REAL_IP_HEADER   the header those proxies put the client address in; default X-Forwarded-For,
#                    e.g. CF-Connecting-IP behind a Cloudflare Tunnel.
set -eu

out=/etc/nginx/conf.d/00-real-ip.conf
proxies="${TRUSTED_PROXIES:-127.0.0.1/32 ::1/128 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 fc00::/7}"
header="${REAL_IP_HEADER:-X-Forwarded-For}"

case "$header" in
  *[!A-Za-z0-9-]* | "") echo "REAL_IP_HEADER is not a header name: $header" >&2; exit 1 ;;
esac

{
  echo "# Generated at start from TRUSTED_PROXIES and REAL_IP_HEADER (see nginx-real-ip.sh)."
  if [ "$proxies" != "none" ]; then
    for p in $(echo "$proxies" | tr ',' ' '); do
      case "$p" in
        *[!0-9A-Fa-f.:/]*) echo "TRUSTED_PROXIES entry is not an address or CIDR: $p" >&2; exit 1 ;;
      esac
      echo "set_real_ip_from $p;"
    done
    echo "real_ip_header $header;"
    # Walk the header from the right and skip every trusted hop: a value a client put in front of
    # the chain is never used.
    echo "real_ip_recursive on;"
  fi
} > "$out"
echo "real-ip: trusting ${proxies} via ${header}"
