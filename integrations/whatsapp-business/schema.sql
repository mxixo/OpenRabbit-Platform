CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  whatsapp_message_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  contact_wa_id TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL,
  message_text TEXT,
  media_id TEXT,
  reply_to_message_id TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  urgency_score SMALLINT NOT NULL DEFAULT 0 CHECK (urgency_score BETWEEN 0 AND 100),
  urgency_reason TEXT,
  raw_payload JSONB NOT NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, whatsapp_message_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_recent_idx
  ON whatsapp_messages (org_id, received_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_review_idx
  ON whatsapp_messages (org_id, reviewed_at, urgency_score DESC, received_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- The deployment adapter must set `app.current_org_id` for every transaction.
CREATE POLICY whatsapp_messages_org_isolation ON whatsapp_messages
  USING (org_id = (SELECT current_setting('app.current_org_id', true)))
  WITH CHECK (org_id = (SELECT current_setting('app.current_org_id', true)));
