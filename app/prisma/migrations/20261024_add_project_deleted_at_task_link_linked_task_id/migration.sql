-- Add deleted_at to projects table (soft delete)
ALTER TABLE "projects" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Remove status column from projects (not using status anymore)
ALTER TABLE "projects" DROP COLUMN "status";

-- Update task_links table to support task linking
ALTER TABLE "task_links" ADD COLUMN "linked_task_id" TEXT;
ALTER TABLE "task_links" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "task_links" ALTER COLUMN "url" DROP NOT NULL;
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_task_id_linked_task_id_key" UNIQUE("task_id", "linked_task_id");

-- Create index on deleted_at for soft delete queries
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");
