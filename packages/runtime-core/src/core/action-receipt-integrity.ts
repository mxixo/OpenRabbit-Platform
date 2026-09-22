import { createHash } from "node:crypto";
import type { ActionReceipt } from "../interfaces/action-receipt.js";

export interface ActionReceiptSeal {
  algorithm: "sha256";
  receiptHash: string;
  previousReceiptHash?: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

function normalizedDigest(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const digest = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error("previousReceiptHash must be a 64-character SHA-256 digest");
  }
  return digest;
}

export function canonicalActionReceipt(receipt: ActionReceipt): string {
  return JSON.stringify(canonicalize(receipt));
}

export function sealActionReceipt(
  receipt: ActionReceipt,
  previousReceiptHash?: string
): ActionReceiptSeal {
  const previous = normalizedDigest(previousReceiptHash);
  const hash = createHash("sha256");
  hash.update("openrabbit.action-receipt.v1\n", "utf8");
  hash.update(previous ?? "", "utf8");
  hash.update("\n", "utf8");
  hash.update(canonicalActionReceipt(receipt), "utf8");

  return {
    algorithm: "sha256",
    receiptHash: hash.digest("hex"),
    ...(previous ? { previousReceiptHash: previous } : {})
  };
}

export function verifyActionReceiptSeal(
  receipt: ActionReceipt,
  seal: ActionReceiptSeal
): boolean {
  if (seal.algorithm !== "sha256") return false;
  if (!/^[a-f0-9]{64}$/.test(seal.receiptHash)) return false;

  try {
    const expected = sealActionReceipt(receipt, seal.previousReceiptHash);
    return expected.receiptHash === seal.receiptHash;
  } catch {
    return false;
  }
}
