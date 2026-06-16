FROM php:8.1-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    freetype-dev \
    libjpeg-turbo-dev \
    libpng-dev \
    libzip-dev \
    icu-dev \
    supervisor \
    curl \
    git \
    unzip \
    ttf-dejavu \
    font-noto-cjk \
    fontconfig \
    postgresql-dev \
    sqlite-dev \
    bash

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    gd \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    pdo_sqlite \
    zip \
    bcmath \
    intl \
    opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy composer.json and install all dependencies in one step
COPY composer.json /var/www/html/composer.json
COPY think /var/www/html/think
RUN composer install --no-interaction --no-scripts --prefer-dist --no-security-blocking

# Copy application code
COPY app/ /var/www/html/app/
COPY config/ /var/www/html/config/
COPY route/ /var/www/html/route/
COPY public/ /var/www/html/public/
COPY .env /var/www/html/.env

# Regenerate autoload with all app code in place
RUN composer dump-autoload --optimize 2>/dev/null; true

# Create necessary directories
RUN mkdir -p runtime public/uploads/albums public/uploads/avatars \
    public/uploads/backgrounds public/uploads/qrcodes public/uploads/logos \
    public/uploads/pages \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 777 runtime public/uploads

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy supervisor config
COPY supervisord.conf /etc/supervisord.conf

# Copy startup script
COPY startup.sh /usr/local/bin/startup.sh
RUN chmod +x /usr/local/bin/startup.sh

# PHP config
RUN echo "upload_max_filesize = 50M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size = 50M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "max_execution_time = 300" >> /usr/local/etc/php/conf.d/uploads.ini

EXPOSE 80

CMD ["/usr/local/bin/startup.sh"]
