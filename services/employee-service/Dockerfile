FROM php:8.3-cli-alpine

# Install dependensi sistem + dev headers untuk ekstensi PHP
RUN apk add --no-cache \
    curl \
    curl-dev \
    git \
    libpng-dev \
    libxml2-dev \
    libzip-dev \
    oniguruma-dev \
    openssl-dev \
    unzip \
    zip

# Install ekstensi PHP yang dibutuhkan Laravel + MySQL
RUN docker-php-ext-install \
    bcmath \
    curl \
    mbstring \
    opcache \
    pdo \
    pdo_mysql \
    xml \
    zip

# Ambil Composer dari image resminya
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy manifest dulu — layer ini hanya berubah jika composer.json/lock berubah
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-audit

# Copy seluruh source aplikasi
COPY . .

# Selesaikan autoload + pastikan direktori storage bisa ditulis
RUN composer dump-autoload --optimize \
    && mkdir -p storage/framework/{sessions,views,cache} storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Jalankan migrasi lalu start built-in server Laravel
CMD ["sh", "-c", "php artisan migrate --force --no-interaction && php artisan serve --host=0.0.0.0 --port=8080"]
