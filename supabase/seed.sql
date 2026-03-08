insert into countries (code, name, latitude, longitude) values
('GB','United Kingdom',55.3781,-3.4360),
('US','United States',37.0902,-95.7129),
('JP','Japan',36.2048,138.2529)
on conflict do nothing;

insert into questions (id, question_text, original_language_code, active_on, status, is_sponsored)
values
('10000000-0000-0000-0000-000000000001','Should AI replace teachers?','en', current_date, 'active', false)
on conflict do nothing;
