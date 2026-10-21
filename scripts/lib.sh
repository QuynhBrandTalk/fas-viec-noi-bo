#!/usr/bin/env bash
# Hàm dùng chung cho các script sao lưu.
# Quy tắc: chỉ ghi tên bước và trạng thái, không ghi nội dung dữ liệu,
# số điện thoại hay email người dùng vào log.

CURRENT_STEP="khởi động"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*"
}

step() {
  CURRENT_STEP="$1"
  log "BƯỚC: $1"
}

require_vars() {
  local missing=0 v
  for v in "$@"; do
    if [ -z "${!v:-}" ]; then
      log "THIẾU BIẾN MÔI TRƯỜNG: $v"
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    exit 1
  fi
}

send_alert() {
  local subject="$1" body="$2"
  local url extra=()

  if [ "$SMTP_PORT" = "465" ]; then
    url="smtps://${SMTP_HOST}:465"
  else
    url="smtp://${SMTP_HOST}:${SMTP_PORT}"
    extra+=(--ssl-reqd)
  fi

  if ! printf 'From: %s\nTo: %s\nSubject: %s\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' \
      "$SMTP_FROM" "$ALERT_EMAIL" "$subject" "$body" \
    | curl -sS --max-time 60 --url "$url" "${extra[@]}" \
        --user "${SMTP_USER}:${SMTP_PASS}" \
        --mail-from "$SMTP_FROM" --mail-rcpt "$ALERT_EMAIL" \
        -T -; then
    log "KHÔNG GỬI ĐƯỢC EMAIL CẢNH BÁO"
  fi
}
