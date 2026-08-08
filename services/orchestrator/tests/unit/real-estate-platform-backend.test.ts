import { describe, expect, it } from "vitest";
import { RealEstatePlatformBackend } from "../../src/real-estate-platform-backend.js";

describe("RealEstatePlatformBackend", () => {
  it("installs the pack idempotently and lists materialized workers", async () => {
    const backend = new RealEstatePlatformBackend();

    const first = await backend.installRealEstatePack("org-api-1");
    const second = await backend.installRealEstatePack("org-api-1");

    expect(first.packId).toBe("pack.real-estate");
    expect(first.workerIds.length).toBeGreaterThanOrEqual(2);
    expect(second).toEqual(first);

    const workers = await backend.listWorkers("org-api-1");
    expect(workers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "acquisitions_analyst" }),
        expect.objectContaining({ role: "research_analyst" })
      ])
    );

    await backend.stopOrg("org-api-1");
  });

  it("rejects tasks until the Real Estate Pack is installed", async () => {
    const backend = new RealEstatePlatformBackend();
    const result = await backend.submitWorkerTask({
      orgId: "org-missing",
      workerId: "worker-1",
      taskId: "deal-missing",
      taskType: "commercial_investment_workflow",
      input: { address: "100 Market St, Phoenix, AZ" }
    });

    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("pack_not_installed");
  });

  it("executes and retrieves an underwriting task through the composed stack", async () => {
    const backend = new RealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-api-2");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const result = await backend.submitWorkerTask({
      orgId: "org-api-2",
      workerId: acquisitionsWorkerId!,
      taskId: "deal-api-1",
      taskType: "commercial_investment_workflow",
      input: {
        address: "100 Market St, Phoenix, AZ",
        purchasePrice: 1200000,
        annualGrossIncome: 165000,
        occupancyRate: 0.92,
        operatingExpenseRatio: 0.38,
        downPaymentPct: 0.3,
        interestRatePct: 6.75,
        amortizationYears: 25
      }
    });

    expect(result.status).toBe("completed");
    expect(result.runtimeProviderId).toBe("openclaw");
    expect(result.output).toMatchObject({
      ok: true,
      workflow: "commercial_investment_analysis"
    });

    const retrieved = await backend.getTaskResult("org-api-2", "deal-api-1");
    expect(retrieved).toEqual(result);

    await backend.stopOrg("org-api-2");
  });
});
