# PHP2Shell（CVE-2026-109618 / CVE-2026-109619）の修正版。浮動タグ php:8.4-fpm だと古いパッチのまま残る
FROM php:8.4.27-fpm

RUN apt-get update && apt-get install -y \
    git unzip libzip-dev libpng-dev libonig-dev libxml2-dev \
    libpq-dev nginx \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql zip bcmath opcache \
    && rm -rf /var/lib/apt/lists/*

# コンテナ内のコードはビルド後に変わらないので、ファイルの更新確認を省いて毎回のコンパイルをなくす
RUN printf 'opcache.enable=1\nopcache.memory_consumption=128\nopcache.interned_strings_buffer=16\nopcache.max_accelerated_files=20000\nopcache.validate_timestamps=0\n' \
    > /usr/local/etc/php/conf.d/zz-opcache.ini

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
