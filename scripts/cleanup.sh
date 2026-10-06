#!/usr/bin/env bash
# Remove dangling and unused Docker images to reclaim disk space.
set -euo pipefail
docker image prune --all --force
