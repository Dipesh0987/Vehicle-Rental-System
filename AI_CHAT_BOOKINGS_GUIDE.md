# AI Booking Chat Integration Guide

## What Was Implemented

The booking AI chat is now integrated with:

- A secure Supabase Edge Function endpoint: `supabase/functions/booking-chat/index.ts`
- A reusable frontend chat widget: `frontend/assets/js/ai-booking-chat.js`
- Booking modal deep-link API in auth layer: `backend/js/auth.js`
- Tailwind-first floating chat UI with icon launcher and in-chat history drawer

## Feature Coverage

- Natural-language booking queries for:
  - upcoming booking dates
  - vehicle details
  - cancellation policy
  - refund status
  - invoice availability
- Answers are grounded in real booking rows from `public.vehicle_bookings`
- Date-relative handling includes: `today`, `tomorrow`, `this weekend`, `next weekend`
- Chat can open booking details directly using CTA: "Here is your booking - tap to view"
- AI cannot directly modify bookings; it returns a confirmation CTA for modification flow
- If unresolved, AI offers support handoff CTA
- Every answer includes booking data-source context/citations
- Session-only history in browser `sessionStorage`
- `Clear chat` resets conversation and starts from a welcome message
- Chat history is not uploaded; only current prompt is sent to server
- In-chat three-line menu opens:
  - recent searches
  - session chat history

## Where To Connect AI API

The recommended production integration point is the Supabase Edge Function:

- Endpoint: `booking-chat`
- File: `supabase/functions/booking-chat/index.ts`

Set API credentials as Supabase Edge Function secrets (never in frontend JS):

- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- Optional: `BOOKING_AI_MODEL` (default `gemini-2.0-flash`)
- Optional support values:
  - `BOOKING_SUPPORT_EMAIL`
  - `BOOKING_SUPPORT_PHONE`

## Free Chatbot API (Gemini)

You can use Gemini free tier from Google AI Studio.

1. Open https://aistudio.google.com/
2. Sign in and create an API key.
3. Use that key as `GEMINI_API_KEY` in Supabase Edge Function secrets.

Notes:

- Free tier has request/token limits.
- Keep key only in server-side secrets, never in frontend JS.
- Current implementation uses rule-based booking resolution first, and Gemini only for response refinement.

### Deploy Function

```bash
supabase functions deploy booking-chat
```

### Set Secrets

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
supabase secrets set BOOKING_AI_MODEL=gemini-2.0-flash
supabase secrets set BOOKING_SUPPORT_EMAIL=support@rentavehiclenepal.com
supabase secrets set BOOKING_SUPPORT_PHONE=+977-9862147350
```

## Frontend Runtime Flow

1. User sends a chat query.
2. Frontend calls `client.functions.invoke("booking-chat", { body: { query, timezone, nowIso } })`.
3. Edge Function authenticates user from bearer token.
4. Edge Function fetches only that user’s bookings and composes a grounded response.
5. Frontend renders answer with citations and tappable actions.

## Privacy Notes

- Session history is only in `sessionStorage`, not `localStorage`.
- No chat history synchronization is implemented.
- Request body only sends the active prompt and time context.
- PII persistence beyond session is avoided.

## Actions Returned By API

- `view_booking`: open booking detail panel with selected booking
- `open_vehicle`: navigate to vehicle detail page
- `confirmation_cta`: route user to modification flow, preserving user confirmation
- `contact_support`: support handoff via mailto

## Optional Improvements

- Add explicit invoice PDF generation endpoint and wire it as a new action type.
- Add explicit refund workflow table/status fields and include them in AI response logic.
- Add telemetry counters without storing message text (for privacy-safe quality metrics).
