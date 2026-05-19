-- Add parent_id to todos table referencing itself for subtasks support
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.todos(id) ON DELETE CASCADE;

-- Add a comment for clarification
COMMENT ON COLUMN public.todos.parent_id IS 'References the parent todo id if this is a subtask';
