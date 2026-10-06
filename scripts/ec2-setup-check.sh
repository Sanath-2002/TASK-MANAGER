#!/usr/bin/env bash
# Confirm Docker is active and the deployed API container reports healthy.
set -euo pipefail

if ! systemctl is-active --quiet docker; then
  echo "Docker service is not running" >&2
  exit 1
fi

status="$(docker inspect --format '{{.State.Health.Status}}' task-api 2>/dev/null || true)"
if [[ "$status" != "healthy" ]]; then
  echo "task-api container health is '${status:-missing}', expected healthy" >&2
  exit 1
fi

echo "Docker is active and task-api is healthy"
