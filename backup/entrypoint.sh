#!/usr/bin/env bash
set -euo pipefail

# Cấu hình rclone (remote tên "dest") lấy từ biến BACKUP_*
export RCLONE_CONFIG_DEST_TYPE=s3
export RCLONE_CONFIG_DEST_PROVIDER="${BACKUP_PROVIDER:-Other}"
export RCLONE_CONFIG_DEST_ENDPOINT="${BACKUP_ENDPOINT:?BACKUP_ENDPOINT chưa được đặt}"
export RCLONE_CONFIG_DEST_ACCESS_KEY_ID="${BACKUP_ACCESS_KEY:?BACKUP_ACCESS_KEY chưa được đặt}"
export RCLONE_CONFIG_DEST_SECRET_ACCESS_KEY="${BACKUP_SECRET_KEY:?BACKUP_SECRET_KEY chưa được đặt}"

# Chế độ lệnh tay (ví dụ: docker compose run ... /scripts/restore-test.sh)
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Chế độ cron: ghi biến môi trường ra file có quyền hạn chế để job cron đọc được
ENV_FILE=/etc/backup.env
umask 077
: > "$ENV_FILE"
for v in \
  APP_DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB \
  BACKUP_AGE_PUBLIC_KEY BACKUP_BUCKET ALERT_EMAIL \
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM \
  RCLONE_CONFIG_DEST_TYPE RCLONE_CONFIG_DEST_PROVIDER RCLONE_CONFIG_DEST_ENDPOINT \
  RCLONE_CONFIG_DEST_ACCESS_KEY_ID RCLONE_CONFIG_DEST_SECRET_ACCESS_KEY; do
  printf 'export %s=%q\n' "$v" "${!v-}" >> "$ENV_FILE"
done

cat > /etc/cron.d/viec-backup <<'EOF'
# Sao lưu mỗi đêm lúc 02:00 (giờ Asia/Ho_Chi_Minh)
0 2 * * * root . /etc/backup.env && /scripts/backup.sh >> /proc/1/fd/1 2>&1
# Kiểm tra sức khoẻ mỗi giờ
0 * * * * root . /etc/backup.env && /scripts/healthcheck.sh >> /proc/1/fd/1 2>&1
EOF
chmod 644 /etc/cron.d/viec-backup

exec cron -f
