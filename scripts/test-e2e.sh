#!/usr/bin/env bash
#
# Playwright end-to-end test runner.
#
# Playwright must run on Node: when it detects the Bun runtime it skips its
# TypeScript/ESM loader (registerESMLoader in playwright/lib/transform/esmLoader.js),
# and specs that use TS-only syntax then fail to load ("AggregateError: N errors
# building <file>"). `bun run` executes package.json scripts with a `node` shim
# on PATH that points at the Bun binary, so this wrapper strips that shim and
# lets the real Node runtime handle the suite.
set -euo pipefail

cd "$(dirname "$0")/.."

node_bin="$(command -v node 2>/dev/null || true)"
if [ -n "$node_bin" ] && [ "$(basename "$(readlink -f "$node_bin")")" = "bun" ]; then
  shim_dir="$(dirname "$node_bin")"
  PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v -x -F "$shim_dir" | paste -sd: -)"
fi

exec node ./node_modules/@playwright/test/cli.js test "$@"
