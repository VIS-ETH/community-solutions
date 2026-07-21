ARG git_branch="<none>"
ARG git_commit="<none>"

# Backend targets:
# - backend: Includes only the backend part. Can be used for development, does not support hot-reloading.
# - backend-hotreload: Support hot-reloading, used only for local deployment. Excludes frontend
#
# Frontend targets:
# - frontend-base: Common base for both deployment and development containers
# - frontend-dev: Target only for local development, supports hot-reload
# - frontend-build: Builds the frontend files that will be included with the backend for final production-ready container.
#
# The `combined` stage extends the `backend` target with files built in the `frontend-build` step. Includes everything, production-ready

FROM ghcr.io/astral-sh/uv:trixie-slim AS backend
LABEL maintainer='cat@vis.ethz.ch'

# install system dependencies
RUN <<EOF
  #!/usr/bin/env bash

  set -euo pipefail
  apt-get update
  apt-get install -y --no-install-recommends \
    smbclient poppler-utils pgbouncer
  rm -rf /var/lib/apt/lists/*
  useradd -s /bin/sh -m app-user
EOF

USER app-user

WORKDIR /app

COPY --chown=app-user:app-user ./backend/pyproject.toml ./backend/uv.lock ./backend/.python-version ./

RUN uv sync --locked --no-dev && mkdir intermediate_pdf_storage

COPY --chown=app-user:app-user ./backend/ ./
COPY --chown=app-user:app-user ./frontend/public/static ./static
COPY --chown=app-user:app-user ./frontend/public/exam10.pdf ./exam10.pdf
RUN uv run manage.py export_openapi

# prevent guincorn from buffering prints from python workers
ENV PYTHONUNBUFFERED=True

COPY --chown=app-user:app-user ./pgbouncer ./pgbouncer

# -------------------------------

FROM node:24-alpine AS frontend-base

WORKDIR /usr/src/app
COPY ./frontend/package.json \
  ./frontend/yarn.lock \
  ./frontend/.yarnrc.yml ./

RUN corepack enable && yarn install --immutable && yarn cache clean

FROM frontend-base AS frontend-build
ARG git_branch
ARG git_commit

COPY ./frontend ./
COPY ./CHANGELOG.md ./CHANGELOG.md
COPY --from=backend /app/static/openapi.json ./public/openapi.json
ENV VITE_GIT_BRANCH=${git_branch}
ENV VITE_GIT_COMMIT=${git_commit}
RUN yarn run build

# -------------------------------

FROM backend AS combined

COPY --from=frontend-build --chown=app-user:app-user /usr/src/app/build/manifest.json \
  /usr/src/app/build/favicon.ico ./
COPY --from=frontend-build --chown=app-user:app-user /usr/src/app/build/index.html ./templates/index.html
COPY --from=frontend-build --chown=app-user:app-user /usr/src/app/build/static ./static

# Bundle Django/app package static assets (e.g. Django Ninja docs UI files)
# into STATIC_ROOT for production serving.
RUN uv run manage.py collectstatic --noinput

# -------------------------------

# Development-only stages
# Backend
FROM backend AS backend-hotreload

ENV IS_DEBUG=true
CMD uv run manage.py migrate \
  && uv run manage.py runserver 0:8081

# Frontend
FROM frontend-base AS frontend-dev

COPY frontend ./
COPY ./CHANGELOG.md ./CHANGELOG.md

RUN yarn install

EXPOSE 3000
CMD ["yarn", "start-docker"]


# Production build as final result
FROM combined
EXPOSE 8080

COPY --chown=app-user:app-user ./configs/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod u+x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
