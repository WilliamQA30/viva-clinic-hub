SELECT cron.unschedule('send-reminders-hourly');

SELECT cron.schedule(
  'send-reminders-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ityjcmqckyofyxuvxdpi.supabase.co/functions/v1/send-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eWpjbXFja3lvZnl4dXZ4ZHBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDg0NzYsImV4cCI6MjA4NDMyNDQ3Nn0.viGD2w3o30f20kwOWwWgXEoYTWltuDGq5R1NmF00s0U"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);