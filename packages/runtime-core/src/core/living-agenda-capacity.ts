import type { CapacityBlock, DailyCapacityAssessment, DailyCapacityInput } from "../interfaces/living-agenda-capacity.js";

function minutesBetween(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60000));
}

function overlapMinutes(a: CapacityBlock, b: CapacityBlock): number {
  const start = Math.max(Date.parse(a.startAt), Date.parse(b.startAt));
  const end = Math.min(Date.parse(a.endAt), Date.parse(b.endAt));
  return Math.max(0, Math.round((end - start) / 60000));
}

export function assessDailyCapacity(input: DailyCapacityInput): DailyCapacityAssessment {
  const totalWindowMinutes = minutesBetween(input.dayStartAt, input.dayEndAt);
  const blocks = [...input.commitments].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const warnings: string[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const overlap = overlapMinutes(blocks[i], blocks[j]);
      if (overlap > 0) warnings.push(`${blocks[i].id} overlaps ${blocks[j].id} by ${overlap} minutes.`);
    }
  }

  const sumKind = (kind: CapacityBlock["kind"]) =>
    blocks.filter((block) => block.kind === kind).reduce((sum, block) => sum + minutesBetween(block.startAt, block.endAt), 0);

  const fixedMinutes = sumKind("fixed_commitment");
  const protectedMinutes = sumKind("protected") + sumKind("focus");
  const recoveryMinutes = sumKind("recovery");
  const flexibleMinutes = sumKind("flexible");
  const reservedMinutes = Math.max(0, input.reserveMinutes ?? 0);

  const blockedMinutes = fixedMinutes + protectedMinutes + recoveryMinutes;
  const rawSchedulable = Math.max(0, totalWindowMinutes - blockedMinutes - reservedMinutes);
  const schedulableMinutes = Math.min(rawSchedulable, input.explicitAvailableMinutes ?? rawSchedulable);

  const refillableMinutes = blocks
    .filter((block) => block.kind === "flexible" && block.refillPolicy === "flexible")
    .reduce((sum, block) => sum + minutesBetween(block.startAt, block.endAt), 0);

  if (blockedMinutes + reservedMinutes > totalWindowMinutes) {
    warnings.push("Protected/fixed/recovery time exceeds the declared daily window; do not create additional work capacity.");
  }

  return {
    totalWindowMinutes,
    fixedMinutes,
    protectedMinutes,
    recoveryMinutes,
    flexibleMinutes,
    schedulableMinutes,
    refillableMinutes,
    blocks,
    warnings
  };
}
