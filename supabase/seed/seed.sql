insert into public.questions(question_text, source_language, asked_on, status)
values ('Should AI replace teachers?', 'en', current_date, 'live')
on conflict (asked_on) do nothing;
