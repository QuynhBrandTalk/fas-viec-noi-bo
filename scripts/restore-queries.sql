-- Mỗi dòng là một truy vấn, phải trả về ít nhất một dòng kết quả.
-- Dòng bắt đầu bằng -- bị bỏ qua.
-- Cập nhật khi schema App A thay đổi (ví dụ thêm truy vấn kiểm tra tài khoản quản trị).
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
SELECT count(*) FROM users;
SELECT count(*) FROM tasks;
