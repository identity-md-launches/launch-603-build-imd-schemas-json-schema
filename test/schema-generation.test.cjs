'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('regenerating schemas leaves every shipped schema byte-for-byte unchanged', () => {
  const scratch = path.join(__dirname, 'scratch');
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'schema-generation-'));
  try {
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.mkdirSync(path.join(directory, 'schemas'));
    const script = path.join(directory, 'scripts/generate-schemas.mjs');
    fs.copyFileSync(path.join(ROOT, 'scripts/generate-schemas.mjs'), script);
    const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const shipped = path.join(ROOT, 'schemas');
    const generated = path.join(directory, 'schemas');
    const names = fs.readdirSync(shipped).sort();
    assert.deepEqual(fs.readdirSync(generated).sort(), names);
    for (const name of names) {
      assert.deepEqual(fs.readFileSync(path.join(generated, name)), fs.readFileSync(path.join(shipped, name)), name);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
