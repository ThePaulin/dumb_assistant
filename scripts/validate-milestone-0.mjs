import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
  } catch (error) {
    fail(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function walk(relativeDirectory) {
  const absoluteDirectory = resolve(root, relativeDirectory);
  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry}`;
    const absolutePath = resolve(root, relativePath);
    return statSync(absolutePath).isDirectory() ? walk(relativePath) : [relativePath];
  });
}

const proposalSchema = readJson('schemas/interpretation-proposal.v1.schema.json');
const itemSchema = readJson('schemas/scheduled-item.v1.schema.json');
const corpus = readJson('evals/interpretation-cases.v1.json');

if (proposalSchema?.title !== 'InterpretationProposalV1') {
  fail('interpretation schema title must be InterpretationProposalV1');
}

if (itemSchema?.title !== 'ScheduledItemV1') {
  fail('scheduled-item schema title must be ScheduledItemV1');
}

if (corpus) {
  if (corpus.schema_version !== '1.0.0') {
    fail('evaluation corpus schema_version must be 1.0.0');
  }

  if (!Array.isArray(corpus.cases) || corpus.cases.length < 50) {
    fail('evaluation corpus must contain at least 50 cases');
  } else {
    const ids = new Set();
    const allowedResults = new Set(['proposal', 'needs_clarification', 'unsupported']);

    for (const testCase of corpus.cases) {
      if (!testCase.id || ids.has(testCase.id)) {
        fail(`evaluation case has a missing or duplicate id: ${testCase.id ?? '<missing>'}`);
      }
      ids.add(testCase.id);

      if (!testCase.input || !testCase.expected) {
        fail(`${testCase.id}: input and expected are required`);
        continue;
      }

      const result = testCase.expected.result;
      if (!allowedResults.has(result)) {
        fail(`${testCase.id}: unknown expected result ${result}`);
      }
      if (result === 'proposal' && (!testCase.expected.intent || !testCase.expected.schedule)) {
        fail(`${testCase.id}: proposals require intent and schedule assertions`);
      }
      if (result === 'needs_clarification' && !testCase.expected.clarification?.field) {
        fail(`${testCase.id}: clarification cases require a field assertion`);
      }
      if (result === 'unsupported' && !testCase.expected.unsupported?.reason_code) {
        fail(`${testCase.id}: unsupported cases require a reason_code assertion`);
      }
    }
  }
}

const roadmap = readFileSync(resolve(root, 'docs/ROADMAP.md'), 'utf8');
const milestoneZero = roadmap.match(/## Milestone 0[\s\S]*?(?=## Milestone 1)/)?.[0];
if (!milestoneZero) {
  fail('ROADMAP.md must contain Milestone 0 before Milestone 1');
} else if (milestoneZero.includes('- [ ]')) {
  fail('Milestone 0 contains unchecked deliverables or exit criteria');
}

const markdownFiles = ['README.md', 'CONTRIBUTING.md', ...walk('docs').filter((path) => extname(path) === '.md')];
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

for (const markdownFile of markdownFiles) {
  const contents = readFileSync(resolve(root, markdownFile), 'utf8');
  for (const match of contents.matchAll(linkPattern)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;

    const targetPath = resolve(root, dirname(markdownFile), target);
    if (!existsSync(targetPath)) {
      fail(`${markdownFile}: broken local link ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Milestone 0 validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Milestone 0 validation passed (${corpus.cases.length} evaluation cases).`);
