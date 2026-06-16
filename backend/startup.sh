#!/bin/bash

echo "[FlipBook] Starting application..."

# Ensure directories exist and have correct permissions
mkdir -p /var/www/html/runtime
mkdir -p /var/www/html/public/uploads/albums
mkdir -p /var/www/html/public/uploads/avatars
mkdir -p /var/www/html/public/uploads/backgrounds
mkdir -p /var/www/html/public/uploads/qrcodes
mkdir -p /var/www/html/public/uploads/logos
mkdir -p /var/www/html/public/uploads/pages

chmod -R 777 /var/www/html/runtime
chmod -R 777 /var/www/html/public/uploads

# Wait for database to be ready
echo "[FlipBook] Waiting for database..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    php -r "
    try {
        \$pdo = new PDO(
            'mysql:host=' . getenv('DB_HOST') . ';port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_NAME'),
            getenv('DB_USER'),
            getenv('DB_PASS'),
            [PDO::ATTR_TIMEOUT => 3]
        );
        echo 'connected';
        exit(0);
    } catch (Exception \$e) {
        exit(1);
    }
    " && break
    RETRY=$((RETRY + 1))
    echo "[FlipBook] Database not ready, retrying ($RETRY/$MAX_RETRIES)..."
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo "[FlipBook] ERROR: Could not connect to database after $MAX_RETRIES attempts"
    exit 1
fi

echo "[FlipBook] Database connected!"

# Initialize admin passwords using PHP
echo "[FlipBook] Initializing user passwords..."
php -r "
try {
    \$pdo = new PDO(
        'mysql:host=' . getenv('DB_HOST') . ';port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4',
        getenv('DB_USER'),
        getenv('DB_PASS')
    );
    \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    \$accounts = [
        ['username' => 'admin', 'password' => '123456'],
        ['username' => 'testuser', 'password' => '123456'],
        ['username' => 'vipuser', 'password' => '123456'],
    ];

    foreach (\$accounts as \$account) {
        \$stmt = \$pdo->prepare('SELECT id, password FROM users WHERE username = ?');
        \$stmt->execute([\$account['username']]);
        \$user = \$stmt->fetch(PDO::FETCH_ASSOC);

        if (\$user) {
            if (strpos(\$user['password'], 'placeholder') !== false || !password_verify(\$account['password'], \$user['password'])) {
                \$hash = password_hash(\$account['password'], PASSWORD_BCRYPT);
                \$update = \$pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
                \$update->execute([\$hash, \$user['id']]);
                echo 'Password initialized for: ' . \$account['username'] . PHP_EOL;
            } else {
                echo 'Password OK for: ' . \$account['username'] . PHP_EOL;
            }
        }
    }
    echo 'Password initialization complete!' . PHP_EOL;
} catch (Exception \$e) {
    echo 'Password init error: ' . \$e->getMessage() . PHP_EOL;
}
"

echo "[FlipBook] Application ready!"
echo "[FlipBook] Frontend: http://localhost:3000"
echo "[FlipBook] Backend API: http://localhost:8000"

# Start supervisor (nginx + php-fpm)
exec /usr/bin/supervisord -c /etc/supervisord.conf
