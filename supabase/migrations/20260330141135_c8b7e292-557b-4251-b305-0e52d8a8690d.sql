
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Allow service role full access to backups" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'backups')
  WITH CHECK (bucket_id = 'backups');
