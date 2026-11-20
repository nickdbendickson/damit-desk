#!/bin/sh
# Double-click this on a Mac. It runs the desk. A plain script opens as text.
cd "$(dirname "$0")" || exit 1
chmod +x ./damit-desk 2>/dev/null
exec ./damit-desk
