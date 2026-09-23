"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const contract = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_provider_search_v1.json"), "utf8")
);
const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "waygo", "contracts", "waygo_provider_search_v1_test_vectors.json"), "utf8")
);

assert.strictEqual(contract.contract, "waygo_provider_search_v1");
assert.strictEqual(contract.status, "pre_source_recovery_reference");
assert.ok(contract.inputs.includes("normalized_constraints"));
assert.ok(contract.inputs.includes("provider_capability_registry"));
assert.strictEqual(contract.search_budget.max_provider_requests_per_category, 4);
assert.strictEqual(contract.search_budget.max_total_requests_per_discovery, 24);
assert.strictEqual(contract.search_budget.retry_only_when_idempotent, true);
assert.strictEqual(contract.request_rules.terms_unknown_or_blocked_behavior, "do_not_call");
assert.strictEqual(contract.request_rules.browser_or_scraping_fallback_not_inferred, true);
assert.strictEqual(contract.cache_rules.refresh_failure_does_not_extend_freshness, true);
assert.strictEqual(contract.provider_failure.failed_request_amount, null);
assert.strictEqual(contract.provider_failure.failed_request_never_means_zero_cost, true);
assert.strictEqual(contract.provider_failure.failed_request_never_becomes_live_quote, true);
assert.strictEqual(contract.normalized_output.only_waygo_provider_evidence_v1_may_enter_cost_or_ranking, true);
assert.strictEqual(contract.normalized_output.unresolved_material_cost_flows_to_total_trip_cost_as_unresolved, true);
assert.strictEqual(contract.execution_boundary.autonomous_purchase, false);
assert.strictEqual(contract.execution_boundary.terms_bypass, false);
assert.strictEqual(contract.execution_boundary.captcha_or_access_control_bypass, false);
assert.strictEqual(contract.execution_boundary.fabricate_price, false);

const byName = new Map(vectors.map((vector) => [vector.name, vector]));
assert.strictEqual(byName.get("duplicate_query_is_deduped").expected.provider_calls, 1);
assert.strictEqual(byName.get("duplicate_query_is_deduped").expected.deduped_calls, 1);
assert.strictEqual(byName.get("unknown_terms_block_provider_call").expected.call_provider, false);
assert.strictEqual(byName.get("stale_cache_cannot_be_provider_fresh").expected.may_claim_current_quote, false);
assert.strictEqual(byName.get("provider_failure_never_becomes_zero_cost").expected.amount, null);
assert.strictEqual(byName.get("provider_failure_never_becomes_zero_cost").expected.material_cost_state, "unresolved");
assert.strictEqual(byName.get("category_fanout_is_bounded").expected.max_provider_calls, 4);
assert.strictEqual(byName.get("unsupported_category_is_rejected").expected.call_provider, false);
assert.strictEqual(byName.get("conflicting_duplicate_evidence_is_preserved").expected.preserve_records, 2);
assert.strictEqual(byName.get("conflicting_duplicate_evidence_is_preserved").expected.ranking_uncertainty, true);

console.log("WayGo provider search contract tests passed.");
