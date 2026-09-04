# OpenRabbit AI-Managed Interface

## Product rule

OpenRabbit is not a workflow-builder product. Users should not be asked to design automations, wire triggers, map fields, manage tokens, or maintain chains of connectors.

The user describes the outcome they want. The connected AI brain decides which approved OpenRabbit capabilities to use, proposes or executes the steps allowed by policy, and asks for human approval only when required.

Examples:

- “Follow up with every new lead from today.”
- “Find the meetings in my inbox and put them on my calendar for approval.”
- “Review my pipeline and tell me who is going cold.”
- “Post something useful for first-time buyers tomorrow.”
- “Show me properties near this address that fit my criteria.”

The AI translates intent into internal workflows. Those workflows remain an implementation detail, not a customer-facing configuration surface.

## Persistent AI brain

The OpenRabbit AI is available everywhere in the desktop workspace through a movable floating control. Users can drag it out of the way, click it when needed, and prompt it without navigating to a separate automation page.

The AI panel should retain conversational context for the session and eventually use the user's authorized workspace context: mail, calendar, CRM, maps/market data, social accounts, files, and other connected tools.

## Connection model

Initial account authorization is unavoidable for private third-party data, but it should happen once through familiar provider sign-in screens.

After authorization:

- OpenRabbit refreshes tokens automatically.
- OpenRabbit verifies connections in the background.
- Users do not manage API keys or OAuth credentials.
- Users do not rebuild connections for each workflow.
- An expired or revoked provider returns to **Ready to connect** and OpenRabbit explains the simplest fix.

## Maps

Maps are a built-in OpenRabbit capability, not a customer connection. Reuse the working map implementation from development, but move production credentials/configuration to OpenRabbit-managed infrastructure. OpenStreetMap remains the zero-configuration baseline; a restricted OpenRabbit-managed Google Maps key can provide the enhanced experience.

Do not migrate temporary developer OAuth tokens into customer accounts. Reuse code, provider adapters, redirect/callback architecture, map configuration, and production-owned credentials where appropriate.

## AI provider choice

OpenRabbit should use an AI-provider adapter so the user can select their preferred intelligence provider without changing the rest of the application.

Target login-first providers:

- OpenAI / ChatGPT — current live desktop provider.
- Google Gemini — target account-based Google sign-in using Gemini CLI/provider tooling where supported.
- Anthropic Claude — target account/subscription-based sign-in where supported.

OpenRabbit capabilities and approvals remain provider-independent. Changing the AI should not force the user to reconnect Gmail, Calendar, CRM, Maps, or Social.

## User-facing architecture

The visible product centers on five operating surfaces:

1. Email
2. Calendar
3. CRM / Pipeline
4. Maps / Market intelligence
5. Social media

The AI brain sits above all five and coordinates them. Internal playbooks, triggers, queues, retries, policies, tool calls, and audit logs are managed behind the interface.

## Human authority

Convenience does not mean silent high-impact actions. OpenRabbit should progressively earn autonomy. Reading, summarizing, organizing, and drafting can be broadly automated. Client-facing messages, calendar changes, CRM writes, social publishing, financial commitments, and other consequential actions follow the user's approval policy.
