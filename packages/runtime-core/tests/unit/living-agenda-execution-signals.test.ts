import { describe, expect, it } from "vitest";
import {
  executionCheckInToSignal,
  taskReflectionToSignal
} from "../../src/core/living-agenda-execution-signals.js";

describe("living agenda execution signal mappers", () => {
  it("maps a swipe completion into a user-action execution signal", () => {
    const signal = executionCheckInToSignal({
      id: "sig-1",
      userId: "user-1",
      itemId: "item-1",
      completed: true,
      observedAt: "2026-08-11T12:03:00Z",
      modality: "swipe",
      reportedCompletionAt: "2026-08-11T12:00:00Z"
    });

    expect(signal.type).toBe("execution_check_in");
    expect(signal.provenance).toBe("user_action");
    expect(signal.payload).toEqual(
      expect.objectContaining({
        itemId: "item-1",
        completed: true,
        modality: "swipe",
        reportedCompletionAt: "2026-08-11T12:00:00Z"
      })
    );
  });

  it("preserves a user-authored reflection separately from outcome state", () => {
    const signal = taskReflectionToSignal({
      id: "sig-2",
      userId: "user-1",
      itemId: "item-1",
      note: "This was harder than expected",
      observedAt: "2026-08-11T12:04:00Z",
      modality: "voice",
      tags: ["difficulty"]
    });

    expect(signal.type).toBe("task_reflection");
    expect(signal.provenance).toBe("user_stated");
    expect(signal.payload).toEqual(
      expect.objectContaining({
        itemId: "item-1",
        note: "This was harder than expected",
        modality: "voice",
        tags: ["difficulty"]
      })
    );
  });
});
