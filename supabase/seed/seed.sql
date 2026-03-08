insert into public.countries(code, name) values
('GB', 'United Kingdom'),
('US', 'United States'),
('IN', 'India')
on conflict (code) do nothing;

insert into public.questions(question_text, original_language, active_on, status)
values ('Should AI replace teachers?', 'en', current_date, 'live')
on conflict (active_on) do nothing;
