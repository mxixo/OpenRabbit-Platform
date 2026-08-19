# Google / Gmail prototype integration

The first live vertical slice uses server-side Google OAuth and the Gmail REST API.

## Required environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (example: `http://localhost:8787/api/oauth/google/callback`)

## Google Cloud setup

1. Enable the Gmail API in the prototype Google Cloud project.
2. Configure Google Auth Platform branding/audience.
3. Create a Web application OAuth client for the deployed prototype (or a Desktop client only for local quickstart testing).
4. Register the exact redirect URI used by the OpenRabbit integration server.
5. During development, add only approved test users.

## Initial scope strategy

Start read-only:

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.readonly`

Do not request send/modify scopes until the read-only inbox loop is stable and the approval/audit path is implemented.

## Demo loop

Connect Gmail -> callback exchanges authorization code -> connection registry stores credentials -> inbox adapter retrieves recent messages -> communications UI renders real messages -> OpenRabbit receives selected message context -> agent proposes a response/action -> approval gate records intent before any later write-capable connector is allowed to execute.

## Production notes

The current in-memory registry is prototype-only. Refresh tokens must be encrypted at rest in a durable per-user credential store before external deployment. OAuth state must also move to a durable/session-aware store when multiple server instances are introduced.