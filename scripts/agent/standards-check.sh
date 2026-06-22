#!/usr/bin/env bash
set -euo pipefail

git diff --check
npm test
npm run check
npm run build
