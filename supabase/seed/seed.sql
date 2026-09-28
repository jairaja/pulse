insert into public.countries(code, name, latitude, longitude) values
('GB', 'United Kingdom', 55.3781, -3.4360),
('US', 'United States', 37.0902, -95.7129),
('IN', 'India', 20.5937, 78.9629),
('BR', 'Brazil', -14.2350, -51.9253),
('NG', 'Nigeria', 9.0820, 8.6753)
on conflict (code) do nothing;

insert into public.questions(question_text, source_language, asked_on, status)
values ('Should AI replace teachers?', 'en', current_date, 'live')
on conflict (asked_on) do nothing;
