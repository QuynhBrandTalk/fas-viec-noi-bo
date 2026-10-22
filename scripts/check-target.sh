#!/usr/bin/env bash
# Kiểm tra đích sao lưu mới trước khi chuyển: ghi, đọc, xoá một file thử.
# Chạy sau khi đổi BACKUP_TYPE hoặc các biến đích, trước khi tin vào sao lưu đêm.
set -euo pipefail
source /scripts/lib.sh

require_vars BACKUP_BUCKET ALERT_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM

REMOTE="dest:${BACKUP_BUCKET}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
NAME="check-$(date +%Y%m%d-%H%M%S).txt"
printf 'kiểm tra đích sao lưu\n' > "$TMP/$NAME"
SIZE="$(stat -c %s "$TMP/$NAME")"

step "ghi file thử"
rclone copy "$TMP/$NAME" "$REMOTE/"

step "đọc lại và so kích thước"
LINE="$(rclone lsf --format sp --separator ';' --files-only --include "$NAME" "$REMOTE/" || true)"
[ "$LINE" = "${SIZE};${NAME}" ] || { log "Kích thước không khớp hoặc không đọc được"; false; }

step "xoá file thử"
rclone delete --include "$NAME" "$REMOTE/"

step "kiểm tra đã xoá"
LEFT="$(rclone lsf --files-only --include "$NAME" "$REMOTE/" || true)"
[ -z "$LEFT" ] || { log "File thử chưa được xoá"; false; }

log "ĐÍCH SAO LƯU HOẠT ĐỘNG: ghi, đọc, xoá đều đạt"
