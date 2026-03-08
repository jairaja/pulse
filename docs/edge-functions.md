# Supabase Edge Functions

## Functions

1. `moderate-submission`
   - Checks profanity/hate/spam.
   - Flags duplicates by semantic similarity.

2. `translate-question`
   - Calls Google Translate and OpenAI translation.
   - Scores fluency + semantic preservation.
   - Writes selected best translation to `question_translations.is_selected=true` with provider `hybrid`.

3. `daily-question-picker`
   - Runs at 00:05 GMT.
   - Picks highest voted approved submission from previous day.
   - Supports developer override and veto.

4. `send-daily-notification`
   - Runs at 12:00 GMT.
   - Sends: "The world is voting now. Today's question is live."

## Developer control panel contract

Admin endpoints (protected by service role):
- Add question manually
- Override tomorrow selection
- Veto / disable / mark duplicate / mark abusive
