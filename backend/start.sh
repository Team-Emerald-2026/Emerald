#!/bin/sh
set -e

php artisan migrate --force
php artisan db:seed --force || echo "db:seed failed; continuing"
exec php artisan serve --host=0.0.0.0 --port="${PORT:-10000}"
