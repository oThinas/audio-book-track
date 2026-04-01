#!/bin/sh
set -e

echo "Running database migrations..."
bun run db:migrate

echo "Running database seed..."
bun run db:seed

echo "Starting application..."
exec "$@"