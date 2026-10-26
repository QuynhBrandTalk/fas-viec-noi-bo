#!/usr/bin/env bash
# Chạy một bước CI; nếu lỗi, đưa 150 dòng cuối thành annotation
# để đọc được qua API mà không cần tải file log.
#   bash ../.github/ci-step.sh "Tên bước" lệnh...
set -o pipefail
TITLE="$1"; shift
LOG="$(mktemp)"
"$@" 2>&1 | tee "$LOG"
CODE=${PIPESTATUS[0]}
if [ "$CODE" -ne 0 ]; then
  MSG="$(tail -n 150 "$LOG" | sed -e 's/\x1b\[[0-9;]*m//g' | sed -e 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
  echo "::error title=${TITLE} (exit ${CODE})::${MSG}"
fi
exit "$CODE"
