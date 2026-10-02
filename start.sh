#!/usr/bin/env sh
cd "$(dirname "$0")"
echo "Open http://127.0.0.1:8080"
python3 -m http.server 8080 --bind 127.0.0.1
