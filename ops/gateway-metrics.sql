-- ClickHouse SQL for Supabase Management API /analytics/endpoints/logs.
-- The caller supplies a bounded UTC range. JSON aggregates contain no request data.
select count() as requests,
  countIf(JSONExtractInt(event_message, 'status') >= 500) as server_errors,
  countIf(JSONExtractString(event_message, 'outcome') = 'CAPTCHA_REQUIRED') as captcha_rejections,
  countIf(JSONExtractString(event_message, 'outcome') = 'CAPTCHA_UNAVAILABLE') as captcha_outages,
  countIf(JSONExtractString(event_message, 'outcome') = 'RATE_LIMITED') as rate_limited,
  quantile(0.95)(JSONExtractInt(event_message, 'duration_ms')) as p95_ms
from logs
where source = 'function_logs' and isValidJSON(event_message)
  and JSONExtractString(event_message, 'event') = 'pulse_gateway'
limit 1;
