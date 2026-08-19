"use strict";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

function extractText(payload) {
  if (payload.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

class OpenAIResponsesProvider {
  constructor({ apiKey, model = "gpt-5.6", fetchImpl = global.fetch }) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
  }

  async run({ input, context = {}, providerTools = [] }) {
    const systemContext = [
      "You are the reasoning engine inside OpenRabbit, an AI real-estate operating environment.",
      "Use supplied environment context when relevant. Distinguish facts from recommendations.",
      "Do not claim an external action was executed unless a tool result explicitly confirms it.",
      "For consequential external actions, recommend or prepare the action for approval rather than implying it was sent or completed.",
      `Environment context JSON: ${JSON.stringify(context)}`,
    ].join("\n");

    const body = {
      model: this.model,
      input: [
        { role: "developer", content: systemContext },
        { role: "user", content: String(input || "") },
      ],
      ...(providerTools.length ? { tools: providerTools, tool_choice: "auto" } : {}),
    };

    const res = await this.fetch(RESPONSES_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error?.message || `OpenAI Responses API failed: ${res.status}`);

    const toolTrace = (payload.output || [])
      .filter((item) => item.type && item.type !== "message" && item.type !== "reasoning")
      .map((item) => ({ type:item.type, name:item.name || item.server_label || null, status:item.status || null }));

    return {
      text: extractText(payload),
      responseId: payload.id,
      model: payload.model || this.model,
      toolTrace,
      proposedActions: [],
      rawUsage: payload.usage || null,
    };
  }
}

module.exports = { OpenAIResponsesProvider, extractText };