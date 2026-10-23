-- Fix: Xóa FK constraint sai trên activity_log.entity_id → tasks
--
-- Vấn đề: ActivityLog dùng entityId làm polymorphic reference
-- ('task' | 'project' | 'user' | 'dependency') nhưng migration đầu
-- có thể đã tạo FK vào bảng tasks, gây FK violation khi log project/user.
--
-- Giải pháp: entityId là plain String, không có FK constraint.

-- Xóa FK nếu tồn tại (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_log_entity_id_fkey'
      AND table_name = 'activity_log'
  ) THEN
    ALTER TABLE "activity_log" DROP CONSTRAINT "activity_log_entity_id_fkey";
  END IF;
END;
$$;
