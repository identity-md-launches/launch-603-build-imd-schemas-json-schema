#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const {validate,actionVersions,knownRefusals,experimentalNotice} = require('../dist/index.js');
function usage() {
  console.log(`${experimentalNotice}\n\nUsage: imd-validate <action> <file> [--version VERSION] [--json]\n       imd-validate --refusals [CODE]\n       imd-validate --help\n\nValidate an action INPUT body (not a quote envelope). Use - for stdin.\nPass --version from GET /openapi.json x-imd-actions to detect new versions.\nWithout --version, this offline tool uses its frozen 2026-10-02 snapshot.\n\nSupported actions:\n${Object.entries(actionVersions).map(([a,v])=>`  ${a.padEnd(18)} ${v}`).join('\n')}\n\nExit: 0 valid; 1 invalid input; 2 unsupported action/version, usage, or file error.\nWarnings describe possible server refusals; local success does not guarantee admission.\nNothing is submitted, signed or paid.`);
}
const args = process.argv.slice(2);
if (args.length === 1 && ['--help','-h'].includes(args[0])) { usage(); process.exit(0); }
if (args[0] === '--refusals') {
  if (args.length > 2) { console.error('Expected --refusals [CODE]'); process.exit(2); }
  const matches = args[1] ? knownRefusals.filter(r=>r.code===args[1]) : knownRefusals;
  if (!matches.length) { console.error(`Unknown refusal code: ${args[1]}`); process.exit(2); }
  console.log(experimentalNotice);
  for (const refusal of matches) console.log(`\n${refusal.code} [${refusal.scope}]\n  ${refusal.cause}\n  ${refusal.remedy}`);
  process.exit(0);
}
let version, json = false;
const positional = [];
for (let i=0;i<args.length;i++) {
  if (args[i] === '--version') {
    if (version !== undefined || !args[i+1] || args[i+1].startsWith('--')) { console.error('--version requires one version'); process.exit(2); }
    version = args[++i];
  } else if (args[i] === '--json') json = true;
  else if (args[i].startsWith('-') && args[i] !== '-') { console.error(`Unknown option: ${args[i]}`); process.exit(2); }
  else positional.push(args[i]);
}
if (positional.length !== 2) { usage(); process.exit(2); }
let text;
try { text = fs.readFileSync(positional[1] === '-' ? 0 : positional[1], 'utf8'); }
catch (error) { console.error(`Cannot read ${positional[1]}: ${error.message}`); process.exit(2); }
let input;
try { input = JSON.parse(text); }
catch (error) {
  const result = {valid:false,action:positional[0],errors:[{code:'invalid_input',path:'/',message:`Invalid JSON: ${error.message}`}],warnings:[]};
  console[json?'log':'error'](json?JSON.stringify(result,null,2):result.errors[0].message); process.exit(1);
}
const result = validate(positional[0],input,{version});
if (json) console.log(JSON.stringify(result,null,2));
else {
  console.log(`${result.valid?'Valid':'Invalid'}: ${result.action} (${result.version || 'unsupported'})`);
  for (const issue of result.errors) console.error(`  ${issue.path}: ${issue.message} [${issue.code}]`);
  for (const issue of result.warnings) console.error(`  warning ${issue.path}: ${issue.message} [${issue.code}]`);
}
process.exit(result.errors.some(e=>e.code.startsWith('unsupported_'))?2:result.valid?0:1);
