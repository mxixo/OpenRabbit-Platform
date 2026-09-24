'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const {
  scanText,
  scanRepositoryHistory,
  looksLikePlaceholder,
  looksLikeCredentialLiteral,
} = require('../scripts/repository-history-secret-scan');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function syntheticCredential(parts) {
  return parts.join('');
}

function testDefiniteTokenDetectionDoesNotReturnSecretValue() {
  const token = ['ghp_', 'A'.repeat(40)].join('');
  const findings = scanText(`TOKEN=${token}\n`);
  assert(findings.some((finding) => finding.rule_id === 'github_token'));
  assert(!JSON.stringify(findings).includes(token));
}

function testGenericCredentialAssignmentAndPlaceholderSuppression() {
  const fixtureParts = ['A9z_k2P-q7V4mN8x', 'T5bR1cD6eF3gH0jL'];
  const secret = syntheticCredential(fixtureParts);
  const findings = scanText(`SUPABASE_SERVICE_ROLE_KEY=${secret}\n`);
  assert(findings.some((finding) => finding.rule_id === 'credential_like_assignment'));
  assert(!JSON.stringify(findings).includes(secret));

  const placeholder = '${process.env.SUPABASE_SERVICE_ROLE_KEY}';
  assert.strictEqual(looksLikePlaceholder(placeholder), true);
  assert.strictEqual(scanText(`SUPABASE_SERVICE_ROLE_KEY=${placeholder}\n`).length, 0);
}

function testGenericDetectorSuppressesCodeExpressionsAndObviousFixtures() {
  assert.strictEqual(looksLikeCredentialLiteral('generateRuntimeCredential()'), false);
  assert.strictEqual(looksLikeCredentialLiteral('process.env.RUNTIME_API_KEY'), false);
  assert.strictEqual(looksLikeCredentialLiteral('paper-secret-do-not-record'), false);
  assert.strictEqual(looksLikeCredentialLiteral(`fixture-${'Z'.repeat(32)}`), false);
  assert.strictEqual(scanText('API_TOKEN=generateRuntimeCredential()\n').length, 0);
  assert.strictEqual(scanText('API_SECRET=paper-secret-do-not-record\n').length, 0);
}

function testPrivateKeyHeaderDetection() {
  const header = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const findings = scanText(`${header}\nnot-a-real-key\n`);
  assert(findings.some((finding) => finding.rule_id === 'pem_private_key'));
}

function testHistoryScanFindsDeletedCredentialWithoutPrintingValue() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'openrabbit-history-scan-'));
  try {
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'OpenRabbit Test']);

    const fixtureParts = ['B7q_M9x-k4T2vN8c', 'R5fD1gH6jL3pS0wZ'];
    const secret = syntheticCredential(fixtureParts);
    fs.writeFileSync(path.join(repo, 'temporary.env'), `OPENAI_API_KEY=${secret}\n`, 'utf8');
    git(repo, ['add', 'temporary.env']);
    git(repo, ['commit', '-qm', 'add temporary credential']);

    fs.unlinkSync(path.join(repo, 'temporary.env'));
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'remove temporary credential']);
    assert.strictEqual(fs.existsSync(path.join(repo, 'temporary.env')), false);

    const report = scanRepositoryHistory({ cwd: repo });
    assert.strictEqual(report.passed, false);
    assert(report.findings.some((finding) => finding.path === 'temporary.env'));
    assert(!JSON.stringify(report).includes(secret));
    assert.strictEqual(report.secret_values_in_report, false);
    assert.strictEqual(report.shallow_repository, false);
    assert.strictEqual(report.history_scope, 'git_rev_list_objects_all');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function testRevisionScopedScanSeparatesLegacyHistoryFromNewFindings() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'openrabbit-history-rev-'));
  try {
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'OpenRabbit Test']);

    fs.writeFileSync(path.join(repo, 'README.md'), '# clean baseline\n', 'utf8');
    git(repo, ['add', 'README.md']);
    git(repo, ['commit', '-qm', 'clean baseline']);
    const cleanRevision = git(repo, ['rev-parse', 'HEAD']);

    const fixtureParts = ['D4p_R8v-k2M7wQ1c', 'N5fH9jL3sT6xB0zY'];
    const secret = syntheticCredential(fixtureParts);
    fs.writeFileSync(path.join(repo, 'temporary.env'), `RUNTIME_API_KEY=${secret}\n`, 'utf8');
    git(repo, ['add', 'temporary.env']);
    git(repo, ['commit', '-qm', 'add temporary credential']);
    fs.unlinkSync(path.join(repo, 'temporary.env'));
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'remove temporary credential']);
    const dirtyRevision = git(repo, ['rev-parse', 'HEAD']);

    const baseline = scanRepositoryHistory({ cwd: repo, revision: cleanRevision });
    const head = scanRepositoryHistory({ cwd: repo, revision: dirtyRevision });

    assert.strictEqual(baseline.passed, true);
    assert.strictEqual(baseline.finding_count, 0);
    assert.strictEqual(baseline.history_scope, 'git_rev_list_objects_revision');
    assert.strictEqual(baseline.history_revision_oid, cleanRevision);
    assert.strictEqual(head.passed, false);
    assert(head.findings.some((finding) => finding.path === 'temporary.env'));
    assert.strictEqual(head.history_revision_oid, dirtyRevision);
    assert(!JSON.stringify(head).includes(secret));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function testCliWithholdsHistoricalRetrievalPointers() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'openrabbit-history-cli-'));
  try {
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'OpenRabbit Test']);

    const fixtureParts = ['C6r_P8y-j3U1wM7b', 'Q4eF0hK5nL2sT9xV'];
    const secret = syntheticCredential(fixtureParts);
    fs.writeFileSync(path.join(repo, 'temporary.env'), `OPENAI_API_KEY=${secret}\n`, 'utf8');
    git(repo, ['add', 'temporary.env']);
    git(repo, ['commit', '-qm', 'add temporary credential']);
    fs.unlinkSync(path.join(repo, 'temporary.env'));
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'remove temporary credential']);

    const scannerPath = path.resolve(__dirname, '../scripts/repository-history-secret-scan.js');
    const reportPath = path.join(repo, 'report.json');
    const result = spawnSync(process.execPath, [scannerPath, '--rev', 'HEAD', '--output', reportPath], {
      cwd: repo,
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 1);
    assert(result.stdout.includes('Repository history secret scan: FAIL'));
    assert(result.stdout.includes('credential_like_assignment'));
    assert(!result.stdout.includes(secret));
    assert(!result.stdout.includes('temporary.env'));
    assert(!result.stdout.includes('blob='));

    const localReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert(localReport.findings.some((finding) => finding.path === 'temporary.env'));
    assert(localReport.findings.some((finding) => typeof finding.blob_oid === 'string'));
    assert.strictEqual(localReport.history_scope, 'git_rev_list_objects_revision');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function testCleanHistoryPasses() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'openrabbit-history-clean-'));
  try {
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'OpenRabbit Test']);
    fs.writeFileSync(path.join(repo, 'README.md'), '# clean fixture\n', 'utf8');
    git(repo, ['add', 'README.md']);
    git(repo, ['commit', '-qm', 'clean']);

    const report = scanRepositoryHistory({ cwd: repo });
    assert.strictEqual(report.passed, true);
    assert.strictEqual(report.finding_count, 0);
    assert(report.scanned_blob_count >= 1);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function run() {
  testDefiniteTokenDetectionDoesNotReturnSecretValue();
  testGenericCredentialAssignmentAndPlaceholderSuppression();
  testGenericDetectorSuppressesCodeExpressionsAndObviousFixtures();
  testPrivateKeyHeaderDetection();
  testHistoryScanFindsDeletedCredentialWithoutPrintingValue();
  testRevisionScopedScanSeparatesLegacyHistoryFromNewFindings();
  testCliWithholdsHistoricalRetrievalPointers();
  testCleanHistoryPasses();
  console.log('repository-history-secret-scan tests passed');
}

run();
