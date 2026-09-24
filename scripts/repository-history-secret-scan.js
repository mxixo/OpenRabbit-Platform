#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROTOCOL = 'openrabbit_repository_history_secret_scan_v1';
const MAX_BLOB_BYTES = 2 * 1024 * 1024;

const DEFINITE_PATTERNS = [
  { id: 'pem_private_key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'aws_access_key_id', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github_token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { id: 'openai_api_key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'google_oauth_client_secret', regex: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'stripe_live_secret', regex: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { id: 'slack_token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
];

const GENERIC_ASSIGNMENT = /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE_KEY|API_KEY)[A-Z0-9_]*)\b\s*[:=]\s*["']?([^\s"'`]{20,})/gim;
const SAFE_VALUE_MARKERS = [
  '${',
  'process.env',
  'os.environ',
  'your_',
  'replace_',
  'example',
  'placeholder',
  'changeme',
  'dummy',
  'fake',
  'redacted',
  'synthetic',
  'fixture',
  'do-not-record',
  'not-a-real',
  'paper-key',
  'paper-secret',
  '***',
  '<secret',
  '<token',
  '<api',
];

function runGit(args, options = {}) {
  const spawnOptions = {
    cwd: options.cwd || process.cwd(),
    input: options.input,
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
  };
  spawnOptions.encoding = Object.prototype.hasOwnProperty.call(options, 'encoding')
    ? options.encoding
    : 'utf8';

  const result = spawnSync('git', args, spawnOptions);
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8').trim()
      : typeof result.stderr === 'string'
        ? result.stderr.trim()
        : '';
    throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`);
  }
  return result.stdout;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function looksLikePlaceholder(value) {
  const lower = value.toLowerCase();
  if (SAFE_VALUE_MARKERS.some((marker) => lower.includes(marker))) return true;
  if (/^[x*._-]{20,}$/i.test(value)) return true;
  if (/^(?:test|dev|local)[-_]/i.test(value)) return true;
  return false;
}

function shannonEntropy(value) {
  if (!value) return 0;
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function credentialCharacterClasses(value) {
  let classes = 0;
  if (/[a-z]/.test(value)) classes += 1;
  if (/[A-Z]/.test(value)) classes += 1;
  if (/\d/.test(value)) classes += 1;
  if (/[^A-Za-z0-9]/.test(value)) classes += 1;
  return classes;
}

function looksLikeCodeExpression(value) {
  if (/^https?:\/\//i.test(value)) return true;
  if (/^(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*[,;)]?$/.test(value)) return true;
  if (/^(?:require|import|getenv|env)\b/i.test(value)) return true;
  if (/[(){};]/.test(value)) return true;
  return false;
}

function looksLikeCredentialLiteral(value) {
  if (looksLikePlaceholder(value) || looksLikeCodeExpression(value)) return false;
  const normalized = value.replace(/[,\]}]+$/, '');
  if (normalized.length < 20) return false;

  const entropy = shannonEntropy(normalized);
  const classes = credentialCharacterClasses(normalized);
  const uniqueCharacters = new Set(normalized).size;

  if (/^[0-9a-f]{32,}$/i.test(normalized)) {
    return uniqueCharacters >= 10 && entropy >= 3.2;
  }
  if (/^[A-Za-z0-9+/_=.-]{24,}$/.test(normalized)) {
    return classes >= 3 && uniqueCharacters >= 12 && entropy >= 3.3;
  }

  return classes >= 3 && uniqueCharacters >= 12 && entropy >= 3.3;
}

function scanText(text) {
  const findings = [];
  for (const pattern of DEFINITE_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      findings.push({ rule_id: pattern.id, line: lineNumberAt(text, match.index) });
      if (match.index === pattern.regex.lastIndex) pattern.regex.lastIndex += 1;
    }
  }

  GENERIC_ASSIGNMENT.lastIndex = 0;
  let match;
  while ((match = GENERIC_ASSIGNMENT.exec(text)) !== null) {
    const variable = match[1];
    const value = match[2];
    if (looksLikeCredentialLiteral(value)) {
      findings.push({
        rule_id: 'credential_like_assignment',
        variable,
        line: lineNumberAt(text, match.index),
      });
    }
    if (match.index === GENERIC_ASSIGNMENT.lastIndex) GENERIC_ASSIGNMENT.lastIndex += 1;
  }
  return findings;
}

function parseBatchCheck(output) {
  const rows = [];
  for (const line of output.split('\n')) {
    if (!line) continue;
    const match = /^([0-9a-f]+)\s+(\w+)\s+(\d+)(?:\s+(.*))?$/.exec(line);
    if (!match) continue;
    rows.push({
      oid: match[1],
      type: match[2],
      size: Number(match[3]),
      filePath: match[4] || '',
    });
  }
  return rows;
}

function normalizeRevision(revision) {
  if (revision === undefined || revision === null || revision === '') return '--all';
  if (revision === '--all') return revision;
  if (typeof revision !== 'string' || revision.trim() === '') {
    throw new Error('history revision must be a non-empty git revision');
  }
  const normalized = revision.trim();
  if (normalized.startsWith('-')) throw new Error('history revision cannot be a git option');
  return normalized;
}

function scanRepositoryHistory({ cwd = process.cwd(), maxBlobBytes = MAX_BLOB_BYTES, revision = '--all' } = {}) {
  const shallow = runGit(['rev-parse', '--is-shallow-repository'], { cwd }).trim();
  if (shallow !== 'false') {
    throw new Error('repository history scan requires a non-shallow clone');
  }

  const normalizedRevision = normalizeRevision(revision);
  const head = runGit(['rev-parse', 'HEAD'], { cwd }).trim();
  const revisionOid = normalizedRevision === '--all'
    ? null
    : runGit(['rev-parse', '--verify', `${normalizedRevision}^{commit}`], { cwd }).trim();
  const revListArgs = normalizedRevision === '--all'
    ? ['rev-list', '--objects', '--all']
    : ['rev-list', '--objects', revisionOid];
  const objects = runGit(revListArgs, { cwd, maxBuffer: 128 * 1024 * 1024 });
  const checked = runGit(
    ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize) %(rest)'],
    { cwd, input: objects, maxBuffer: 128 * 1024 * 1024 },
  );
  const rows = parseBatchCheck(checked);

  const seenBlobs = new Set();
  const findings = [];
  let scannedBlobCount = 0;
  let skippedLargeBlobCount = 0;
  let skippedBinaryBlobCount = 0;

  for (const row of rows) {
    if (row.type !== 'blob' || seenBlobs.has(row.oid)) continue;
    seenBlobs.add(row.oid);
    if (row.size > maxBlobBytes) {
      skippedLargeBlobCount += 1;
      continue;
    }

    const blob = runGit(['cat-file', '-p', row.oid], {
      cwd,
      encoding: null,
      maxBuffer: Math.max(maxBlobBytes + 1024, 4 * 1024 * 1024),
    });
    if (Buffer.isBuffer(blob) && blob.includes(0)) {
      skippedBinaryBlobCount += 1;
      continue;
    }
    const text = Buffer.isBuffer(blob) ? blob.toString('utf8') : String(blob);
    scannedBlobCount += 1;
    for (const finding of scanText(text)) {
      findings.push({
        ...finding,
        path: row.filePath || null,
        blob_oid: row.oid,
      });
    }
  }

  findings.sort((a, b) =>
    String(a.path).localeCompare(String(b.path)) ||
    a.line - b.line ||
    a.rule_id.localeCompare(b.rule_id),
  );

  const scannerPath = path.resolve(__filename);
  const scannerSha256 = crypto.createHash('sha256').update(fs.readFileSync(scannerPath)).digest('hex');
  return {
    protocol: PROTOCOL,
    scanned_at_utc: new Date().toISOString(),
    repository_head: head,
    history_revision: normalizedRevision,
    history_revision_oid: revisionOid,
    history_scope: normalizedRevision === '--all' ? 'git_rev_list_objects_all' : 'git_rev_list_objects_revision',
    shallow_repository: false,
    scanner_sha256: scannerSha256,
    maximum_scanned_blob_bytes: maxBlobBytes,
    scanned_blob_count: scannedBlobCount,
    skipped_large_blob_count: skippedLargeBlobCount,
    skipped_binary_blob_count: skippedBinaryBlobCount,
    finding_count: findings.length,
    findings,
    secret_values_in_report: false,
    passed: findings.length === 0,
  };
}

function parseArgs(argv) {
  const options = { output: null, revision: '--all' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output') {
      if (!argv[i + 1]) throw new Error('--output requires a path');
      options.output = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--rev') {
      if (!argv[i + 1]) throw new Error('--rev requires a git revision');
      options.revision = normalizeRevision(argv[i + 1]);
      i += 1;
    } else {
      throw new Error(`unsupported argument: ${argv[i]}`);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = scanRepositoryHistory({ revision: options.revision });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const destination = path.resolve(options.output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, serialized, { encoding: 'utf8', flag: 'wx' });
  }

  const ruleCounts = {};
  for (const finding of report.findings) {
    ruleCounts[finding.rule_id] = (ruleCounts[finding.rule_id] || 0) + 1;
  }
  process.stdout.write(
    `Repository history secret scan: ${report.passed ? 'PASS' : 'FAIL'}; ` +
    `${report.scanned_blob_count} blobs scanned; ${report.finding_count} findings.\n`,
  );
  for (const [rule, count] of Object.entries(ruleCounts).sort(([a], [b]) => a.localeCompare(b))) {
    process.stdout.write(`- ${rule}: ${count}\n`);
  }
  if (!report.passed) {
    process.stdout.write(
      'Finding locations are intentionally withheld from CI logs. Run the scanner only in a trusted local clone for detailed classification.\n',
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Repository history secret scan failed closed: ${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = {
  PROTOCOL,
  scanText,
  scanRepositoryHistory,
  looksLikePlaceholder,
  looksLikeCredentialLiteral,
  shannonEntropy,
  normalizeRevision,
};
