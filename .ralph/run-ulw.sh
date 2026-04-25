#!/bin/bash
set -euo pipefail
cd "/home/ronin704/Projects/allura memory"
exec ./ralph/ulw-loop.sh 5 >> /tmp/ulw-loop.log 2>&1
