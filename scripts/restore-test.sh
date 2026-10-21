#!/usr/bin/env bash
set -euo pipefail
source /scripts/lib.sh

require_vars POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB BACKUP_BUCKET \
  ALERT_EMAIL SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM AGE_PRIVATE_KEY_FILE

REMOTE="dest:${BACKUP_BUCKET}"
TOL="${RESTORE_TOLERANCE_PERCENT:-1}"
TABLES="${RESTORE_TABLES:-users tasks}"
TEST_DB="restore_test"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  log "THẤT BẠI: $1"
  send_alert "[Việc nội bộ] Thử khôi phục thất bại" "$1. Database $TEST_DB được giữ lại để kiểm tra."
  exit 1
}
# Lỗi bất ngờ: không xoá database thử, chỉ báo cảnh báo
trap 'log "LỖI tại bước: $CURRENT_STEP"; send_alert "[Việc nội bộ] Thử khôi phục thất bại: $CURRENT_STEP" "Dừng tại bước: $CURRENT_STEP. Database $TEST_DB (nếu có) được giữ lại."; exit 1' ERR

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL=(psql -h db -U "$POSTGRES_USER" -v ON_ERROR_STOP=1 -X -q)

[ -f "$AGE_PRIVATE_KEY_FILE" ] || fail "không thấy file khoá riêng được mount"

step "tải bản mới nhất"
LATEST="$(rclone lsf --files-only --include "viec-*.dump.age" "$REMOTE/" | sort | tail -1)"
[ -n "$LATEST" ] || fail "không tìm thấy bản sao lưu nào trên bucket"
rclone copy "$REMOTE/$LATEST" "$TMP/"
rclone copy "$REMOTE/$LATEST.sha256" "$TMP/"

step "kiểm tra checksum"
(cd "$TMP" && sha256sum -c "$LATEST.sha256")

step "giải mã"
age -d -i "$AGE_PRIVATE_KEY_FILE" -o "$TMP/restore.dump" "$TMP/$LATEST"

step "tạo database thử"
EXISTS="$("${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'")"
[ -z "$EXISTS" ] || fail "database $TEST_DB đã tồn tại từ lần trước, cần người vận hành kiểm tra"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE ${TEST_DB}"

step "pg_restore"
pg_restore -h db -U "$POSTGRES_USER" -d "$TEST_DB" --no-owner --exit-on-error "$TMP/restore.dump"

step "so sánh số dòng"
ROWS=""
for t in $TABLES; do
  a="$("${PSQL[@]}" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM ${t}")"
  b="$("${PSQL[@]}" -d "$TEST_DB" -tAc "SELECT count(*) FROM ${t}")"
  ok="$(awk -v a="$a" -v b="$b" -v t="$TOL" 'BEGIN {
    m = (a > b ? a : b);
    if (m == 0) { print 1; exit }
    d = (a > b ? a - b : b - a) * 100 / m;
    print (d <= t) ? 1 : 0
  }')"
  [ "$ok" = "1" ] || fail "bảng ${t} lệch quá ngưỡng ${TOL}%: production=${a}, bản thử=${b}"
  ROWS+="| ${t} | ${a} | ${b} | ok |"$'\n'
done

step "chạy truy vấn mẫu"
while IFS= read -r q; do
  [ -z "$q" ] && continue
  [[ "$q" == --* ]] && continue
  out="$("${PSQL[@]}" -d "$TEST_DB" -tAc "$q")"
  [ -n "$out" ] || fail "truy vấn không có kết quả: $q"
done < /scripts/restore-queries.sql

step "dọn database thử"
"${PSQL[@]}" -d postgres -c "DROP DATABASE ${TEST_DB}"

step "ghi nhật ký khôi phục"
mkdir -p /docs/restore-logs
{
  echo "## $(date '+%Y-%m-%d %H:%M %z') · Đạt · file $LATEST"
  echo ""
  echo "| Bảng | Production | Bản thử | Kết quả |"
  echo "|---|---|---|---|"
  printf '%s' "$ROWS"
  echo ""
} >> /docs/restore-logs/restore-log.md

log "KẾT QUẢ: ĐẠT"
