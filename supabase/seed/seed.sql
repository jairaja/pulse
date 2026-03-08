insert into countries (code, name, lat, lon) values
('GB','United Kingdom',55.3781,-3.4360),
('US','United States',37.0902,-95.7129),
('JP','Japan',36.2048,138.2529),
('AU','Australia',-25.2744,133.7751)
on conflict do nothing;

insert into questions (question_text, source_language, scheduled_for, status)
values ('Should AI replace teachers?','en', current_date, 'published')
on conflict do nothing;
