# Outlook Automation Module

This module is isolated under `server/email-automation` and does not alter existing client/opportunity APIs.

## What It Does

- Pulls Outlook inbox messages via Microsoft Graph.
- Extracts structured ERP intent/data using LLM (OpenRouter/OpenAI) only.
- Auto-creates/updates `Client` and `Opportunity` using your existing models/logic.
- Uses confidence threshold for auto-processing.
- Sends low-confidence messages to manual review queue.
- Stores full ingestion history and audit decision trail.

## Mounted Route

- Base path: `/api/email-automation`

## Required Environment Variables

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `OUTLOOK_MAILBOX` (email address of mailbox to monitor)
- `MONGO_URI` (already used by your server)

## AI Keys (one of these)

- `OPENROUTER_API_KEY` (recommended for your requested test flow)
- `OPENAI_API_KEY`

## Optional Environment Variables

- `EMAIL_AUTOMATION_USER_EMAIL` (user who will own auto-created entities)
- `MAIL_AUTOMATION_AUTO_THRESHOLD` (default `0.9`)
- `EMAIL_AUTOMATION_MODEL` (default `openai/gpt-4o-mini`)
- `EMAIL_AUTOMATION_LLM_ENDPOINT` (default `https://openrouter.ai/api/v1/chat/completions`)

## Microsoft Graph Permissions (App Registration)

Application permissions:

- `Mail.Read`
- `Mail.ReadWrite` (optional, only if you later want move/flag actions)
- `User.Read.All` (optional)
- `offline_access` not required for client-credentials flow

Also grant admin consent in the Azure tenant.

Minimum recommended for this implementation:

- Required: `Mail.Read` (Application)
- Optional for webhook lifecycle management: `MailboxSettings.Read` (Application)
- Optional if you want to mark/move messages later: `Mail.ReadWrite` (Application)

## API Endpoints

- `GET /api/email-automation/health`
- `GET /api/email-automation/graph/token-check`
- `POST /api/email-automation/ingest/pull`
- `POST /api/email-automation/ingest/message` (manual testing)
- `POST /api/email-automation/ingest/unified` (email + teams + attachment text + notes in one payload)
- `GET /api/email-automation/queue?status=needs_review`
- `POST /api/email-automation/queue/:id/review`
- `GET /api/email-automation/history`
- `POST /api/email-automation/webhook` (Graph subscription callback)

## Safe Rollout

1. Set `MAIL_AUTOMATION_AUTO_THRESHOLD=0.98` for initial production.
2. Use `POST /ingest/pull` with `{ "forceReview": true }` for dry run.
3. Review queue items and approve/reject (used when AI confidence is low or AI call fails).
4. Lower threshold only after extraction accuracy is stable.
