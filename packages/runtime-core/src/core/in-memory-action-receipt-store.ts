import type {
  ActionReceipt,
  ActionReceiptFilter,
  ActionReceiptStore
} from "../interfaces/action-receipt.js";

function cloneReceipt(receipt: ActionReceipt): ActionReceipt {
  return JSON.parse(JSON.stringify(receipt)) as ActionReceipt;
}

function requireNonBlank(value: string | undefined, field: string): void {
  if (!value?.trim()) throw new Error(`${field} is required`);
}

function validateReceipt(
  input: Omit<ActionReceipt, "createdAt"> & { createdAt?: string }
): void {
  requireNonBlank(input.id, "action receipt id");
  requireNonBlank(input.orgId, "action receipt orgId");
  requireNonBlank(input.action, "action receipt action");
  requireNonBlank(input.policy?.policyVersion, "action receipt policyVersion");

  if (!input.provenance?.actorType) {
    throw new Error("action receipt provenance.actorType is required");
  }
  if (!input.provenance?.commandOrigin) {
    throw new Error("action receipt provenance.commandOrigin is required");
  }
  if (!input.policy?.guardianDecision) {
    throw new Error("action receipt policy.guardianDecision is required");
  }
  if (!input.policy?.risk) {
    throw new Error("action receipt policy.risk is required");
  }
  if (!Array.isArray(input.policy?.requiredCapabilities)) {
    throw new Error("action receipt policy.requiredCapabilities is required");
  }

  const capabilities = input.policy.requiredCapabilities.map((value) => value.trim());
  if (capabilities.some((value) => !value)) {
    throw new Error("action receipt required capabilities must be non-blank");
  }
  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error("action receipt required capabilities must be unique");
  }

  if (input.provider) {
    requireNonBlank(input.provider.provider, "action receipt provider.provider");
    if (!input.provider.executionMode) {
      throw new Error("action receipt provider.executionMode is required");
    }
  }

  if (
    input.effectStatus === "confirmed" &&
    input.provider &&
    !input.provider.requestId?.trim() &&
    !input.provider.externalReceiptId?.trim()
  ) {
    throw new Error(
      "confirmed provider effects require provider requestId or externalReceiptId"
    );
  }
}

export class InMemoryActionReceiptStore implements ActionReceiptStore {
  private readonly receipts = new Map<string, ActionReceipt>();

  append(
    input: Omit<ActionReceipt, "createdAt"> & { createdAt?: string }
  ): ActionReceipt {
    validateReceipt(input);

    if (this.receipts.has(input.id)) {
      throw new Error(`Action receipt already exists: ${input.id}`);
    }

    const receipt: ActionReceipt = {
      ...cloneReceipt({
        ...input,
        createdAt: input.createdAt ?? new Date().toISOString()
      } as ActionReceipt)
    };

    this.receipts.set(receipt.id, receipt);
    return cloneReceipt(receipt);
  }

  get(orgId: string, id: string): ActionReceipt | undefined {
    const receipt = this.receipts.get(id);
    if (!receipt || receipt.orgId !== orgId) return undefined;
    return cloneReceipt(receipt);
  }

  list(orgId: string, filter?: ActionReceiptFilter): ActionReceipt[] {
    return Array.from(this.receipts.values())
      .filter((receipt) => {
        if (receipt.orgId !== orgId) return false;
        if (filter?.taskId && receipt.taskId !== filter.taskId) return false;
        if (filter?.workerId && receipt.provenance.workerId !== filter.workerId) {
          return false;
        }
        if (filter?.action && receipt.action !== filter.action) return false;
        if (filter?.effectStatus && receipt.effectStatus !== filter.effectStatus) {
          return false;
        }
        return true;
      })
      .map(cloneReceipt);
  }
}
