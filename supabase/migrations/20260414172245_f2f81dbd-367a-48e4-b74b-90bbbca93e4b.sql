-- Add index on parent_event_id for batch operations on series
CREATE INDEX IF NOT EXISTS idx_schedule_events_parent_event_id 
ON public.schedule_events (parent_event_id);

-- Add composite index on (user_id, start_time) for range queries
CREATE INDEX IF NOT EXISTS idx_schedule_events_user_start 
ON public.schedule_events (user_id, start_time);