#!/usr/bin/env bash
set -euo pipefail
source /scripts/lib.sh

require_vars APP_DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB \
  BACKUP_AGE_PUBLIC_KEY BACKUP_BUCKET ALERT_EMAIL \
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM

REMOTE="dest:${BACKUP_BUCKET}"
TMP="$(mktemp -d)"
START="$(date +%s)"
NAME="viec-$(date +%Y%m%d-%H%M%S).dump.age"

trap 'rm -rf "$TMP"' EXIT
trap 'log "LỖI tại bước: $CURRENT_STEP"; send_alert "[Việc nội bộ] Sao lưu thất bại: $CURRENT_STEP" "Sao lưu đêm thất bại tại bước: $CURRENT_STEP. Xem log container backup."; exit 1' ERR

step "pg_dump"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$TMP/raw.dump"

step "mã hoá age"
age -r "$BACKUP_AGE_PUBLIC_KEY" -o "$TMP/$NAME" "$TMP/raw.dump"
rm -f "$TMP/raw.dump"

step "tạo checksum"
(cd "$TMP" && sha256sum "$NAME" > "$NAME.sha256")

step "đẩy lên bucket"
rclone copy "$TMP/$NAME" "$REMOTE/"
rclone copy "$TMP/$NAME.sha256" "$REMOTE/"

step "kiểm tra bucket"
SIZE="$(stat -c %s "$TMP/$NAME")"
REMOTE_LINE="$(rclone lsf --format sp --separator ';' --files-only --include "$NAME" "$REMOTE/" || true)"
[ "$REMOTE_LINE" = "${SIZE};${NAME}" ] || { log "Kích thước trên bucket không khớp"; false; }
SHA_FOUND="$(rclone lsf --files-only --include "$NAME.sha256" "$REMOTE/" || true)"
[ -n "$SHA_FOUND" ] || { log "Không thấy file checksum trên bucket"; false; }

step "áp dụng lịch giữ bản"
mapfile -t ALL < <(rclone lsf --files-only --include "viec-*.dump.age" "$REMOTE/" | sort -r)
declare -A KEEP
daily=0; sundays=0; firsts=0
for f in "${ALL[@]}"; do
  d="${f:5:8}"
  if [ "$daily" -lt 7 ]; then
    KEEP[$f]=1; daily=$((daily + 1))
  fi
  if [ "$(date -d "$d" +%u)" = "7" ] && [ "$sundays" -lt 4 ]; then
    KEEP[$f]=1; sundays=$((sundays + 1))
  fi
  if [ "${d:6:2}" = "01" ] && [ "$firsts" -lt 3 ]; then
    KEEP[$f]=1; firsts=$((firsts + 1))
  fi
done
for f in "${ALL[@]}"; do
  if [ -z "${KEEP[$f]:-}" ]; then
    log "Xoá bản cũ: $f"
    rclone delete --include "${f}*" "$REMOTE/"
  fi
done

step "ghi nhật ký"
log "HOÀN TẤT: file=$NAME bytes=$SIZE thời_gian=$(( $(date +%s) - START ))s số_bản_giữ=${#KEEP[@]}"
