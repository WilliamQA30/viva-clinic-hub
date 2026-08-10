DO $$
BEGIN
  PERFORM cron.unschedule('send-birthday-messages-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'send-birthday-messages-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xayavfggzkgivgixfpqt.supabase.co/functions/v1/send-birthday-messages',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhheWF2ZmdnemtnaXZnaXhmcHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxMTYsImV4cCI6MjA5ODQxMTExNn0.85wa5tw50V0stNg9o45O8Jcq3N4EJ2z22noGCMN41y8'
    ),
    body := jsonb_build_object('scheduled', true, 'time', now())
  );
  $$
);