'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('..');
const fixture = require('./live/check-2026-10-02.json');
const byName = Object.fromEntries(fixture.cases.map(entry => [entry.name, entry]));
const local = name => validate(byName[name].request.action, byName[name].request.input);
const liveHas = (name, code) => byName[name].response.blockers?.some(blocker => blocker.code === code);

test('live paths: dot and ./src validate, absolute and parent paths fail', () => {
  for (const name of ['step_dot', 'step_dot_src']) {
    assert.equal(byName[name].status, 200);
    assert.equal(byName[name].response.blockers.length, 0);
    assert.equal(local(name).valid, true, name);
  }
  assert.equal(local('root_dot').valid, true);
  for (const name of ['step_absolute', 'step_parent']) {
    assert.equal(byName[name].status, 400);
    assert.equal(local(name).valid, false, name);
  }
});

test('live protected paths: .git and its descendants get protected_path', () => {
  for (const name of ['step_git', 'git_hook']) {
    assert.ok(liveHas(name, 'protected_path'), name);
    assert.ok(local(name).errors.some(error => error.code === 'protected_path'), name);
  }
  assert.ok(local('git_root').errors.some(error => error.code === 'protected_path'));
});

test('live planning: chain step keys and dependencies get unplannable_steps', () => {
  for (const name of ['chain_key', 'chain_depends_on']) {
    assert.ok(liveHas(name, 'unplannable_steps'), name);
    assert.ok(local(name).errors.some(error => error.code === 'unplannable_steps'), name);
  }
});

test('live path budget: directories expand while files and /** globs count once', () => {
  for (const name of ['eight_directories', 'sixteen_files', 'step_glob_sixteen']) {
    assert.equal(byName[name].response.blockers.length, 0, name);
    assert.equal(local(name).valid, true, name);
  }
  for (const name of ['nine_directories', 'eight_directories_one_file', 'root_nine_directories']) {
    assert.ok(liveHas(name, 'bad_path_count'), name);
    assert.ok(local(name).errors.some(error => error.code === 'bad_path_count'), name);
  }
});

test('live launch terms: mismatched supply, decimals or transfer tax warn only', () => {
  for (const name of ['launch_supply', 'launch_decimals', 'launch_tax']) {
    assert.ok(liveHas(name, 'launch_token'), name);
    const result = local(name);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.ok(result.warnings.some(warning => warning.code === 'launch_token'), name);
  }
  assert.equal(liveHas('launch_standard', 'launch_token'), false);
  assert.equal(local('launch_standard').warnings.some(warning => warning.code === 'launch_token'), false);
});
