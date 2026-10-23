#!/bin/sh
set -e

echo "▶ Chạy Prisma migration..."
# prisma CLI được copy vào node_modules trong runner stage
./node_modules/.bin/prisma migrate deploy

echo "▶ Khởi động ứng dụng..."
exec node server.js
