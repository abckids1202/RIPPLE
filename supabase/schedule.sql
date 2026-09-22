-- Run once in the hosted Supabase SQL editor after enabling pg_cron, pg_net,
-- and Vault. Store these values in Vault first:
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'ripple_project_url');
-- select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_KEY', 'ripple_publishable_key');
-- select vault.create_secret('YOUR_LONG_RANDOM_CRON_SECRET', 'ripple_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('ripple-research-discovery-15m', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_project_url') || '/functions/v1/research-daily',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_publishable_key'), 'x-ripple-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_cron_secret')),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('ripple-research-worker-15m', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_project_url') || '/functions/v1/research-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_publishable_key'), 'x-ripple-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_cron_secret')),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('ripple-publish-daily-0005-utc', '5 0 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_project_url') || '/functions/v1/publish-daily',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_publishable_key'), 'x-ripple-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'ripple_cron_secret')),
    body := '{}'::jsonb
  );
$$);
