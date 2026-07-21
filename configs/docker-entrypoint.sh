#!/usr/bin/env bash

set -euo pipefail

{
  cd pgbouncer
  uv run generate_ini.py

  pgbouncer /dev/shm/pgbouncer.ini
} &

{
  set -a
  SIP_POSTGRES_DB_SERVER=/dev/shm
  SIP_POSTGRES_DB_PORT=6432
  if [[ "${SIP_POSTGRES_DB_USER:-prod}" == "docker" ]]; then
    IS_DEBUG=true
  else
    IS_DEBUG=false
  fi
  SIP_POSTGRES_DB_USER=pgbouncer-community-solutions
  SIP_POSTGRES_DB_PW=""
  ALLOWED_HOSTS="${ALLOWED_HOMEORGS:-ethz.ch}"
  prometheus_multiproc_dir=/dev/shm
  set +a

  uv run manage.py wait_for_database

  uv run manage.py migrate

  uv run manage.py configure_cors

  uv run gunicorn backend.wsgi \
    -b 0.0.0.0:8080 \
    -w 4 \
    --worker-class gevent \
    --worker-tmp-dir /dev/shm \
    --log-level debug
} &

wait -n
