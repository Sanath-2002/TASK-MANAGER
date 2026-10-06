#!/usr/bin/env bash
# Follow logs from the running API container.
set -euo pipefail
docker logs --follow --tail 100 task-api
