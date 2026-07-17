import { describe, expect, it } from "vitest";
import { validateWorkflowDefinition } from "../../src/validator.js";

describe("workflow definition validator", () => {
  it("accepts valid workflow definitions", () => {
    const result = validateWorkflowDefinition({
      workflowId: "wf1",
      version: "0.1.0",
      name: "demo",
      steps: [
        {
          id: "s1",
          name: "step",
          action: "demo.run",
          guardrails: { policyCheck: true, requiresApproval: false, maxRetries: 1 }
        }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duplicate steps and invalid retries", () => {
    const result = validateWorkflowDefinition({
      workflowId: "wf1",
      version: "0.1.0",
      name: "demo",
      steps: [
        {
          id: "s1",
          name: "one",
          action: "a",
          guardrails: { policyCheck: true, requiresApproval: false, maxRetries: -1 }
        },
        {
          id: "s1",
          name: "two",
          action: "b",
          guardrails: { policyCheck: true, requiresApproval: false, maxRetries: 1 }
        }
      ]
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicate step id"))).toBe(true);
  });
});
