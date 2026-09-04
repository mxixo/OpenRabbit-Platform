import { describe, expect, it } from "vitest";
import { bootstrapRealEstateOrg } from "../../src/bootstrap-real-estate.js";

describe("real-estate bootstrap composition", () => {
  it("installs the pack, materializes workers, and runs underwriting through OpenClaw runtime boundary", async () => {
    const app = await bootstrapRealEstateOrg("org-demo");

    expect(app.service.isStarted()).toBe(true);
    expect(app.acquisitionsWorker.role).toBe("acquisitions_analyst");
    expect(app.acquisitionsWorker.allowedCapabilities).toContain("real-estate");
    expect(app.acquisitionsWorker.allowedTools).toContain("deal.underwrite");
    expect(app.researchWorker?.role).toBe("research_analyst");

    const result = await app.runUnderwriting({
      taskId: "underwrite-demo-1",
      input: {
        address: "100 Market St, Phoenix, AZ",
        purchasePrice: 1200000,
        annualGrossIncome: 165000,
        occupancyRate: 0.92,
        operatingExpenseRatio: 0.38,
        downPaymentPct: 0.3,
        interestRatePct: 6.75,
        amortizationYears: 25,
        units: 8
      }
    });

    expect(result.status).toBe("completed");
    expect(result.runtimeProviderId).toBe("openclaw");
    expect(result.workerId).toBe(app.acquisitionsWorker.id);
    expect(result.output).toMatchObject({
      ok: true,
      workflow: "commercial_investment_analysis",
      report: {
        address: "100 Market St, Phoenix, AZ"
      }
    });

    const duplicate = await app.runUnderwriting({
      taskId: "underwrite-demo-1",
      input: {
        address: "Different address that must not re-execute"
      }
    });
    expect(duplicate).toEqual(result);
  });

  it("rejects an empty organization id", async () => {
    await expect(bootstrapRealEstateOrg(" ")).rejects.toThrow("orgId is required");
  });
});
