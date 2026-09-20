import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { WorkflowExecutionResult } from "./contracts.js";
import {
  WorkflowIdempotencyClaim,
  WorkflowIdempotencyStore
} from "./reliability.js";

type CompletedRecord = {
  schemaVersion: 1;
  scopeKey: string;
  result: WorkflowExecutionResult;
};

type ScopeRecord = {
  schemaVersion: 2;
  scopeKey: string;
  claimToken: string;
};

function cloneResult(result: WorkflowExecutionResult): WorkflowExecutionResult {
  return JSON.parse(JSON.stringify(result)) as WorkflowExecutionResult;
}

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}

/**
 * Durable, dependency-free idempotency store for a single shared filesystem.
 *
 * The scope directory is created with an atomic `mkdir`. Across processes that
 * share the same persistent filesystem, only one claimant can create it; all
 * later claimants observe an in-progress or completed record. The winning claim
 * receives an opaque token persisted in `scope.json`; only that token may publish
 * the terminal result. This ownership fence is required before safe lease/reclaim
 * semantics can be introduced because a stale worker must not be able to complete
 * a scope after ownership has transferred.
 *
 * Completed results are published with an atomic hard-link so an existing
 * terminal result is never overwritten by a second completion attempt.
 *
 * This closes the process-restart and same-host multi-process gaps of the
 * in-memory reference store. It intentionally does NOT implement automatic
 * lease expiry or crash-after-provider-write recovery: an orphaned in-progress
 * claim remains blocked until an explicit reconciliation mechanism is added.
 * That fail-closed behavior is safer than replaying a consequential external
 * write whose provider outcome is unknown.
 *
 * Schema-v1 scope records created before claim-token fencing are deliberately
 * not accepted for completion after upgrade. They remain fail-closed and require
 * manual/provider reconciliation rather than being granted synthetic ownership.
 *
 * Do not use this backend across hosts that do not share one filesystem, or on
 * filesystems whose atomic mkdir/link semantics are not guaranteed. A database
 * or Redis compare-and-set implementation remains the preferred horizontally
 * scaled production backend.
 */
export class FilesystemWorkflowIdempotencyStore implements WorkflowIdempotencyStore {
  constructor(private readonly rootDirectory: string) {
    if (!rootDirectory.trim()) {
      throw new Error("rootDirectory cannot be blank");
    }
  }

  private scopeDirectory(scopeKey: string): string {
    const digest = createHash("sha256").update(scopeKey, "utf8").digest("hex");
    return join(this.rootDirectory, digest);
  }

  private async readCompleted(
    scopeDirectory: string,
    scopeKey: string
  ): Promise<WorkflowExecutionResult | undefined> {
    const completedPath = join(scopeDirectory, "completed.json");
    let raw: string;
    try {
      raw = await readFile(completedPath, "utf8");
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        return undefined;
      }
      throw error;
    }

    const parsed = JSON.parse(raw) as CompletedRecord;
    if (
      parsed.schemaVersion !== 1 ||
      parsed.scopeKey !== scopeKey ||
      parsed.result?.status !== "completed"
    ) {
      throw new Error("idempotency completion record is invalid or belongs to another scope");
    }
    return cloneResult(parsed.result);
  }

  async claim(scopeKey: string): Promise<WorkflowIdempotencyClaim> {
    if (!scopeKey.trim()) {
      throw new Error("scopeKey cannot be blank");
    }
    await mkdir(this.rootDirectory, { recursive: true });
    const scopeDirectory = this.scopeDirectory(scopeKey);

    try {
      await mkdir(scopeDirectory);
      const claimToken = randomUUID();
      const scopeRecord: ScopeRecord = { schemaVersion: 2, scopeKey, claimToken };
      await writeFile(
        join(scopeDirectory, "scope.json"),
        JSON.stringify(scopeRecord),
        { encoding: "utf8", flag: "wx" }
      );
      return { state: "acquired", claimToken };
    } catch (error) {
      if (!isErrno(error, "EEXIST")) {
        throw error;
      }
    }

    const completed = await this.readCompleted(scopeDirectory, scopeKey);
    if (completed) {
      return { state: "completed", result: completed };
    }

    // A directory without completed.json means another execution owns the claim,
    // including the conservative case where its process crashed mid-flight.
    return { state: "in_progress" };
  }

  async complete(
    scopeKey: string,
    claimToken: string,
    result: WorkflowExecutionResult
  ): Promise<void> {
    if (!claimToken.trim()) {
      throw new Error("claimToken cannot be blank");
    }
    if (result.status !== "completed") {
      throw new Error("only completed workflow results may be stored for idempotent replay");
    }

    const scopeDirectory = this.scopeDirectory(scopeKey);
    const scopePath = join(scopeDirectory, "scope.json");
    let scopeRecord: ScopeRecord;
    try {
      scopeRecord = JSON.parse(await readFile(scopePath, "utf8")) as ScopeRecord;
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        throw new Error("idempotency scope must be durably claimed before completion");
      }
      throw error;
    }
    if (
      scopeRecord.schemaVersion !== 2 ||
      scopeRecord.scopeKey !== scopeKey ||
      !scopeRecord.claimToken
    ) {
      throw new Error(
        "idempotency scope record is invalid, legacy, or belongs to another scope"
      );
    }
    if (scopeRecord.claimToken !== claimToken) {
      throw new Error("idempotency claim token does not own this scope");
    }

    const completedPath = join(scopeDirectory, "completed.json");
    const tempPath = join(scopeDirectory, `completed.${randomUUID()}.tmp`);
    const record: CompletedRecord = {
      schemaVersion: 1,
      scopeKey,
      result: cloneResult(result)
    };

    await writeFile(tempPath, JSON.stringify(record), { encoding: "utf8", flag: "wx" });
    try {
      // link() creates the destination only when it does not already exist,
      // giving us no-overwrite terminal publication on the same filesystem.
      await link(tempPath, completedPath);
    } catch (error) {
      if (isErrno(error, "EEXIST")) {
        throw new Error("idempotency scope is already completed");
      }
      throw error;
    } finally {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}
