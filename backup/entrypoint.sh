#!/usr/bin/env bash
set -euo pipefail

# Đích sao lưu được chọn bằng BACKUP_TYPE:
#   s3   : S3 tương thích (Cloudflare R2, Backblaze B2, ...). Mặc định.
#   sftp : VPS khác trong nước, truy cập qua SFTP.
# Scripts trong /scripts chỉ dùng remote tên "dest:" nên không cần đổi khi đổi loại đích.

BACKUP_TYPE="${BACKUP_TYPE:-s3}"

case "$BACKUP_TYPE" in
  s3)
    export RCLONE_CONFIG_DEST_TYPE=s3
    export RCLONE_CONFIG_DEST_PROVIDER="${BACKUP_PROVIDER:-Other}"
    export RCLONE_CONFIG_DEST_ENDPOINT="${BACKUP_ENDPOINT:?BACKUP_ENDPOINT chưa được đặt}"
    export RCLONE_CONFIG_DEST_ACCESS_KEY_ID="${BACKUP_ACCESS_KEY:?BACKUP_ACCESS_KEY chưa được đặt}"
    export RCLONE_CONFIG_DEST_SECRET_ACCESS_KEY="${BACKUP_SECRET_KEY:?BACKUP_SECRET_KEY chưa được đặt}"
    ;;
  sftp)
    export RCLONE_CONFIG_DEST_TYPE=sftp
    export RCLONE_CONFIG_DEST_HOST="${BACKUP_SFTP_HOST:?BACKUP_SFTP_HOST chưa được đặt}"
    export RCLONE_CONFIG_DEST_PORT="${BACKUP_SFTP_PORT:-22}"
    export RCLONE_CONFIG_DEST_USER="${BACKUP_SFTP_USER:?BACKUP_SFTP_USER chưa được đặt}"
    export RCLONE_CONFIG_DEST_KEY_FILE="${BACKUP_SFTP_KEY_FILE:?BACKUP_SFTP_KEY_FILE chưa được đặt}"
    # Ghim khoá máy chủ để tránh tấn công giả mạo. Bắt buộc với sftp.
    export RCLONE_CONFIG_DEST_KNOWN_HOSTS_FILE="${BACKUP_SFTP_KNOWN_HOSTS:?BACKUP_SFTP_KNOWN_HOSTS chưa được đặt}"
    if [ ! -f "$RCLONE_CONFIG_DEST_KEY_FILE" ]; then
      echo "Không thấy khoá SFTP tại $RCLONE_CONFIG_DEST_KEY_FILE" >&2
      exit 1
    fi
    ;;
  *)
    echo "BACKUP_TYPE không hợp lệ: $BACKUP_TYPE (chỉ chấp nhận s3 hoặc sftp)" >&2
    exit 1
    ;;
esac

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
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM; do
  printf 'export %s=%q\n' "$v" "${!v-}" >> "$ENV_FILE"
done
# Tất cả biến cấu hình rclone của remote "dest" (tự động theo loại đích đã chọn)
for v in $(compgen -v RCLONE_CONFIG_DEST_); do
  printf 'export %s=%q\n' "$v" "${!v}" >> "$ENV_FILE"
done

cat > /etc/cron.d/viec-backup <<'EOF'
# Sao lưu mỗi đêm lúc 02:00 (giờ Asia/Ho_Chi_Minh)
0 2 * * * root . /etc/backup.env && /scripts/backup.sh >> /proc/1/fd/1 2>&1
# Kiểm tra sức khoẻ mỗi giờ
0 * * * * root . /etc/backup.env && /scripts/healthcheck.sh >> /proc/1/fd/1 2>&1
EOF
chmod 644 /etc/cron.d/viec-backup

exec cron -f
