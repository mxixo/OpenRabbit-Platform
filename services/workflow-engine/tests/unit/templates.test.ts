import { describe, expect, it } from "vitest";
import { WorkflowDefinition } from "../../src/contracts.js";
import { validateWorkflowDefinition } from "../../src/validator.js";
import leadIntake from "../../../../workflows/templates/lead-intake-workflow.json" with { type: "json" };
import complianceReview from "../../../../workflows/templates/compliance-review-workflow.json" with { type: "json" };
import transactionClose from "../../../../workflows/templates/transaction-close-workflow.json" with { type: "json" };

describe("workflow templates", () => {
  it("conform to workflow definition schema", () => {
    const templates: WorkflowDefinition[] = [
      leadIntake as WorkflowDefinition,
      complianceReview as WorkflowDefinition,
      transactionClose as WorkflowDefinition
    ];
    for (const template of templates) {
      const validation = validateWorkflowDefinition(template);
      expect(validation.valid).toBe(true);
    }
  });
});
