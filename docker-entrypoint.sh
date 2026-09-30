#!/bin/sh
set -eu
# Fly volumes arrive owned by root. The app runs as node after preparing its
# private journal directory; no credentials or journal data are echoed.
if [ "${X402_ANALYTICS_DIR:-}" = "/data/analytics" ]; then
  mkdir -p /data/analytics
  chown node:node /data/analytics
  chmod 700 /data/analytics
fi
exec su-exec node "$@"
