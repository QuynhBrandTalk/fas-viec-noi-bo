#!/bin/sh
set -e

# Thiếu biến bắt buộc thì dừng ngay với thông báo rõ, thay vì chạy rồi lỗi khi đăng nhập
for v in DATABASE_URL AUTH_SECRET AUTH_URL SMTP_HOST; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then
    echo "✖ Thiếu biến môi trường $v — xem .env.example" >&2
    exit 1
  fi
done

echo "▶ Chạy Prisma migration..."
node node_modules/prisma/build/index.js migrate deploy

echo "▶ Khởi động ứng dụng..."
exec node server.js
