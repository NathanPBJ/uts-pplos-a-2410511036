FROM php:8.3-cli-alpine

# Install dependensi sistem
RUN apk add --no-cache \
    curl \
    git \
    unzip \
    libpng-dev \
    libxml2-dev \
    oniguruma-dev

# Install ekstensi PHP yang dibutuhkan Laravel + MySQL
RUN docker-php-ext-install \
    pdo \
    pdo_mysql \
    mbstring \
    xml \
    bcmath \
    opcache

# Ambil Composer dari image resminya
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy manifest dulu — layer ini hanya berubah jika composer.json/lock berubah
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

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
