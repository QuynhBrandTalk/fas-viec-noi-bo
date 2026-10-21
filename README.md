# Việc nội bộ: M0 (hạ tầng) và M1 (sao lưu)

Phạm vi: chỉ dựng hạ tầng và sao lưu. Trang web trong `app/` chỉ là trang giữ chỗ, sẽ được thay bằng App A ở P1.

## 1. Chuẩn bị máy chủ (thủ công, theo đặc tả mục 2.5)

1. Tạo người dùng quản trị, thêm khoá SSH công khai.
2. Tắt đăng nhập SSH bằng mật khẩu và đăng nhập root trực tiếp.
3. Bật tường lửa, chỉ mở 22, 80, 443.
4. Bật cập nhật bảo mật tự động.
5. Cài Docker và Docker Compose.
6. Thêm swap 2 GB nếu RAM dưới 2 GB.

## 2. Cấu hình

```bash
cp .env.example .env
```

Điền các giá trị thật vào `.env`. Không commit file này.

Tạo cặp khoá age trên máy cá nhân của người giữ khoá, không tạo trên máy chủ:

```bash
age-keygen -o age.key
```

- Dòng `# public key: age1...` trong file `age.key` là khoá công khai, đặt vào `BACKUP_AGE_PUBLIC_KEY` trong `.env`.
- File `age.key` là khoá riêng. Cất ở hai nơi an toàn theo biên bản R2, không đặt trên máy chủ và không gửi qua email.

## 3. Chạy M0 trên staging

```bash
docker compose up -d --build
docker compose ps
```

Kiểm tra theo tiêu chí:

| Mã | Lệnh kiểm tra |
|---|---|
| M0-1 | `docker compose ps`, các dịch vụ `healthy` |
| M0-2 | Mở `https://APP_DOMAIN` trên trình duyệt, chứng chỉ hợp lệ |
| M0-3 | Từ máy ngoài: `nc -vz <IP> 5432`, phải bị từ chối |
| M0-4 | `docker compose ps`, chỉ `caddy` có cổng ra ngoài |
| M0-5 | `ssh -o PreferredAuthentications=password user@<IP>`, phải bị từ chối |
| M0-6 | `curl -I https://APP_DOMAIN`, có đủ bốn header bảo mật |

## 4. Chạy M1 trên staging

Chạy sao lưu thử ngay (dùng file môi trường đã được script cron tạo ra):

```bash
docker compose exec backup bash -c '. /etc/backup.env && /scripts/backup.sh'
```

Thử khôi phục. Khoá riêng được mount tạm, không lưu trong container:

```bash
docker compose run --rm \
  -v /đường/dẫn/tới/age.key:/run/secrets/age.key:ro \
  -e AGE_PRIVATE_KEY_FILE=/run/secrets/age.key \
  backup /scripts/restore-test.sh
```

Kết quả được ghi vào `docs/restore-logs/restore-log.md`.

**Lưu ý quan trọng:** `restore-test.sh` so sánh bảng `users` và `tasks`. Các bảng này chỉ có sau khi App A có migration đầu tiên (P1). Trước đó, hãy đặt `RESTORE_TABLES` và sửa `scripts/restore-queries.sql` cho khớp schema thử, hoặc chạy M1-3 sau khi P1 có schema.

## 5. Lịch chạy tự động

| Việc | Lịch |
|---|---|
| Sao lưu | 02:00 hằng ngày (giờ Asia/Ho_Chi_Minh) |
| Kiểm tra sức khoẻ | Mỗi giờ |
| Thử khôi phục | Thủ công, hằng tháng (mục 4) |

## 6. Ghi chú vận hành

- Nếu mật khẩu có ký tự `$`, Docker Compose có thể nội suy sai. Nên chọn mật khẩu chỉ gồm chữ và số, hoặc dùng dạng đã escape theo tài liệu Compose.
- Log của cron đi ra stdout của container. Xem bằng `docker compose logs -f backup`.
- Script cảnh báo gửi email qua SMTP. Hãy gửi thử một lần trước khi tin vào cảnh báo (kiểm tra M1-6 tạm tắt bucket để xác nhận email đến).
