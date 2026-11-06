#!/bin/sh
set -eu
mkdir -p /data/.leas /data/projects
if [ "$(id -u)" = 0 ]; then
  chown -R node:node /data/.leas /data/projects
  exec su-exec node "$0" "$@"
fi
exec node /opt/leas/src/cli.js update:serve --port "${PORT:-4190}" --url "${LEAS_PUBLIC_URL:?Set the public HTTPS origin}"
