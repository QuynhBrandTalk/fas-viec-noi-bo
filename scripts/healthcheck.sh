#!/usr/bin/env bash
set -euo pipefail
source /scripts/lib.sh

require_vars APP_DOMAIN BACKUP_BUCKET ALERT_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM

REMOTE="dest:${BACKUP_BUCKET}"
PROBLEMS=()

if ! curl -fsS --max-time 15 -o /dev/null "https://${APP_DOMAIN}/healthz"; then
  PROBLEMS+=("Trang /healthz không trả về 200")
fi

LAST="$(rclone lsf --format tp --separator ';' --files-only --include 'viec-*.dump.age' "$REMOTE/" \
  | sort -t';' -k2 | tail -1 || true)"
if [ -z "$LAST" ]; then
  PROBLEMS+=("Không tìm thấy bản sao lưu nào trên bucket hoặc không truy cập được bucket")
else
  TS="${LAST%%;*}"
  TS="$(printf '%s' "$TS" | sed -E 's/\.[0-9]+//')"
  AGE_H=$(( ( $(date +%s) - $(date -d "$TS" +%s) ) / 3600 ))
  if [ "$AGE_H" -gt 26 ]; then
    PROBLEMS+=("Bản sao lưu mới nhất cách đây ${AGE_H} giờ")
  fi
fi

if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  BODY="$(printf '%s\n' "${PROBLEMS[@]}")"
  log "CÓ VẤN ĐỀ: ${BODY}"
  send_alert "[Việc nội bộ] Kiểm tra sức khoẻ thất bại" "$BODY"
  exit 1
fi

log "ỔN ĐỊNH"
