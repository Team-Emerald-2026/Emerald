FROM php:8.4-fpm

RUN apt-get update && apt-get install -y \
    git unzip libzip-dev libpng-dev libonig-dev libxml2-dev \
    libpq-dev nginx \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql zip bcmath \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 775 storage bootstrap/cache \
    && rm -f /etc/nginx/sites-enabled/default \
    && printf '[www]\nclear_env = no\npm.max_children = 20\npm.start_servers = 4\npm.min_spare_servers = 2\npm.max_spare_servers = 6\n' \
        > /usr/local/etc/php-fpm.d/zz-env.conf

ENV PORT=10000

EXPOSE 10000

CMD ["sh", "/var/www/html/start.sh"]
