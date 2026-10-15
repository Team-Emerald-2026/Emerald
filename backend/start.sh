#!/bin/sh
set -e

php artisan migrate --force
php artisan db:seed --class=AdminUserSeeder --force || echo "admin seed failed; continuing"

PORT="${PORT:-10000}"

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${PORT};
    listen [::]:${PORT};
    server_name _;
    root /var/www/html/public;
    index index.php;
    client_max_body_size 10m;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        include fastcgi_params;
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT \$realpath_root;
        fastcgi_hide_header X-Powered-By;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
php-fpm -D
exec nginx -g 'daemon off;'
