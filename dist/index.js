"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = exports.knownRefusals = exports.actionVersions = exports.experimentalNotice = void 0;
exports.getSchema = getSchema;
exports.validate = validate;
const job_1 = require("./job");
const refusals_json_1 = __importDefault(require("./refusals.json"));
const schedule_1 = require("./schedule");
const fs = require('node:fs');
const pathModule = require('node:path');
const { Ajv, addFormats } = require('../vendor/ajv.cjs');
exports.experimentalNotice = 'Experimental, commissioned as a test of the IMD swarm. It may not work as described. Read the code, start with small amounts, no warranty.';
exports.actionVersions = Object.freeze({
    'job.open': 'job-1', 'job.continue': 'job-1', 'launch.open': 'launch-1',
    'workflow.open': 'workflow-1', 'oracle.request': 'oracle-1',
    'schedule.create': 'schedule-1', 'schedule.topup': 'topup-1'
});
exports.knownRefusals = freeze(refusals_json_1.default);
function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}
const loaded = {};
for (const file of fs.readdirSync(pathModule.join(__dirname, '../schemas')).filter(name => name.endsWith('.json')).sort()) {
    loaded[file.slice(0, -5)] = JSON.parse(fs.readFileSync(pathModule.join(__dirname, '../schemas', file), 'utf8'));
}
exports.schemas = freeze(loaded);
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: true, ownProperties: true, verbose: true });
addFormats(ajv);
for (const schema of Object.values(exports.schemas))
    ajv.addSchema(schema);
const validators = new Map();
function getSchema(action, version) {
    if (!Object.hasOwn(exports.actionVersions, action))
        throw new Error(`unsupported_action: ${action}`);
    const supported = exports.actionVersions[action];
    if (version !== undefined && version !== supported)
        throw new Error(`unsupported_version: ${action} ${version}; supported version is ${supported}`);
    if (action === 'job.open' || action === 'job.continue')
        return {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $ref: `${exports.schemas[supported].$id}#/$defs/${action === 'job.open' ? 'open' : 'continue'}`
        };
    return exports.schemas[supported];
}
function pointer(value) { return value.replace(/~/g, '~0').replace(/\//g, '~1'); }
/** No coercion, defaults, network requests, payment or input mutation. */
function validate(action, input, options = {}) {
    const errors = [], warnings = [];
    const result = { valid: false, action, version: options.version ?? exports.actionVersions[action], errors, warnings };
    let schema;
    try {
        schema = getSchema(action, options.version);
    }
    catch (error) {
        const message = error.message;
        errors.push({ code: message.split(':')[0], path: '/', message });
        return result;
    }
    let serialized;
    try {
        serialized = JSON.stringify(input);
    }
    catch {
        errors.push({ code: 'invalid_input', path: '/', message: 'must be JSON serializable (no cycles or bigint)' });
        return result;
    }
    if (serialized === undefined) {
        errors.push({ code: 'invalid_input', path: '/', message: 'must be a JSON value' });
        return result;
    }
    if (!isJson(input)) {
        errors.push({ code: 'invalid_input', path: '/', message: 'must contain only JSON values and finite numbers' });
        return result;
    }
    const key = action;
    if (!validators.has(key))
        validators.set(key, ajv.compile(schema));
    const validator = validators.get(key);
    if (!validator(input)) {
        for (const err of validator.errors || []) {
            if (err.keyword === 'if')
                continue; // The concrete failed branch already explains why.
            let location = err.instancePath || '';
            if (err.propertyName)
                location += '/' + pointer(err.propertyName);
            if (err.keyword === 'required')
                location += '/' + pointer(err.params.missingProperty);
            if (err.keyword === 'additionalProperties')
                location += '/' + pointer(err.params.additionalProperty);
            let message = err.message || 'does not match schema';
            if (err.keyword === 'false schema')
                message = 'field is not allowed for this action or selection';
            if (err.keyword === 'dependentRequired') {
                location += '/' + pointer(err.params.missingProperty);
                message = `required field ${err.params.missingProperty} must be present together with ${err.params.property}`;
            }
            if (err.keyword === 'not' && err.parentSchema?.not?.required)
                message = `fields ${err.parentSchema.not.required.join(' and ')} are mutually exclusive`;
            if (err.keyword === 'not' && err.parentSchema?.not?.enum)
                message = 'reference-only or planner-only skills are not allowed as runnable skills';
            if (err.keyword === 'enum')
                message += ': ' + err.params.allowedValues.map((v) => JSON.stringify(v)).join(', ');
            if (err.keyword === 'const')
                message += ': ' + JSON.stringify(err.params.allowedValue);
            errors.push({ code: 'invalid_input', path: location || '/', message });
        }
    }
    const record = input;
    if (record && typeof record === 'object' && !Array.isArray(record)) {
        semantic(action, record, '', errors, warnings);
        // Actual quote includes requestKey/action/input, not just input. Compact size
        // is a lower bound; the caller's whitespace/transport bytes can be larger.
        const quoteBytes = Buffer.byteLength(JSON.stringify({ requestKey: '00000000-0000-4000-8000-000000000000', action, input }));
        if (quoteBytes > 16384)
            errors.push({ code: 'invalid_input', path: '/', message: `compact quote body is ${quoteBytes} UTF-8 bytes; maximum is 16384 bytes (16 KiB)` });
    }
    result.valid = errors.length === 0;
    return result;
}
function isJson(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (Array.isArray(value))
        return Array.from(value).every(isJson);
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype || value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === null)
        return Object.values(value).every(isJson);
    return false;
}
function semantic(action, body, prefix, errors, warnings) {
    const fail = (path, message, code = 'invalid_input') => errors.push({ code, path: prefix + path, message });
    const warn = (path, message, code) => warnings.push({ code, path: prefix + path, message });
    if (['job.open', 'job.continue', 'launch.open'].includes(action))
        (0, job_1.jobChecks)(body, prefix, errors, warnings);
    if (action === 'launch.open' && ['evm_project', 'univ4_hook'].includes(body.onchain) && typeof body.objective === 'string' && launchTokenMismatch(body.objective))
        fail('/objective', 'launch_token: project and hook launches use 1,000,000,000 tokens, 18 decimals and plain transfers; check the requested token terms with the server', 'launch_token');
    if (action === 'oracle.request') {
        for (const field of ['min', 'max']) {
            const value = body.guards?.[field];
            if (typeof value === 'string' && /^\d+$/.test(value) && BigInt(value) > (1n << 256n) - 1n)
                fail(`/guards/${field}`, 'must fit uint256 (maximum 2^256 - 1)');
        }
        if (Number.isInteger(body.quorum) && Number.isInteger(body.panelSize) && body.quorum > body.panelSize)
            fail('/quorum', 'quorum must be <= panelSize');
        if (typeof body.window?.fromBlock === 'number' && typeof body.window?.toBlock === 'number' && body.window.fromBlock > body.window.toBlock)
            fail('/window/toBlock', 'must be >= fromBlock');
        if (typeof body.guards?.min === 'string' && typeof body.guards?.max === 'string' && /^\d+$/.test(body.guards.min) && /^\d+$/.test(body.guards.max) && BigInt(body.guards.min) > BigInt(body.guards.max))
            fail('/guards/max', 'must be >= guards.min');
    }
    if (action === 'workflow.open') {
        if (body.draft && typeof body.draft === 'object') {
            (0, job_1.jobChecks)(body.draft, prefix + '/draft', errors, warnings);
            if (Array.isArray(body.draft.steps)) {
                const frontends = body.draft.steps.filter((step) => ['frontend-for-contract', 'build-website'].includes(step?.skill));
                const reviews = body.draft.steps.filter((step) => step?.skill === 'adversarial-review');
                if (frontends.length !== 1)
                    fail('/draft/steps', 'workflow must contain exactly one front end (frontend-for-contract or build-website)');
                if (reviews.length === 0)
                    fail('/draft/steps', 'workflow requires an independent adversarial-review');
            }
            if (body.permissions?.onchain?.kind !== undefined && body.permissions.onchain.kind !== body.draft.onchain)
                fail('/permissions/onchain/kind', 'must match draft.onchain');
            if (body.draft.chainId !== undefined && body.permissions?.onchain?.chainId !== undefined && body.draft.chainId !== body.permissions.onchain.chainId)
                fail('/permissions/onchain/chainId', 'must match draft.chainId');
            if (body.draft.github === true && body.permissions?.github !== true)
                fail('/permissions/github', 'must be true when draft.github is true');
            if (body.draft.ipfs && body.permissions?.ipfs !== true && body.permissions?.ipfs !== body.draft.ipfs)
                fail('/permissions/ipfs', 'must allow draft.ipfs (true or the same site label)');
            (0, job_1.workflowDag)(body.draft, prefix + '/draft', errors);
        }
        const folded = [body.request, body.context, body.draft?.objective].filter(v => typeof v === 'string').join(' ').replace(/\s+/g, ' ').trim();
        if (Array.from(folded).length > 7000)
            warn('/request', 'request + context + draft objective exceed about 7,000 folded characters; shorten the request before the server evaluator checks it', 'objective_too_large');
        if (typeof body.request === 'string' && /\b(token|erc[ -]?20)\b/i.test(body.request) && !hasNumericSupply(body.request))
            warn('/request', "missing_fact token_supply: state the token's numerical total supply in the workflow request", 'missing_fact');
    }
    if (action === 'schedule.create') {
        if (body.input && typeof body.input === 'object' && ['job.open', 'oracle.request'].includes(body.action))
            semantic(body.action, body.input, prefix + '/input', errors, warnings);
        const floor = body.action === 'job.open' ? 30 : 10;
        if (body.cadence && typeof body.cadence === 'object') {
            if (typeof body.cadence.every === 'string') {
                const minutes = (0, schedule_1.intervalMinutes)(body.cadence.every);
                if (minutes === undefined || !Number.isFinite(minutes))
                    fail('/cadence/every', 'must be an ISO 8601 weeks/days/time duration without calendar months or years');
                else if (minutes < floor)
                    fail('/cadence/every', `must be at least ${floor} minutes between runs`);
            }
            if (typeof body.cadence.cron === 'string') {
                try {
                    if ((0, schedule_1.cronMinimumMinutes)(body.cadence.cron) < floor)
                        fail('/cadence/cron', `must be at least ${floor} minutes between runs`);
                }
                catch (error) {
                    fail('/cadence/cron', error.message);
                }
                if (body.cadence.tz && !['UTC', 'Etc/UTC'].includes(body.cadence.tz))
                    warn('/cadence/tz', 'cron minimum spacing was checked in wall time; the server must confirm daylight-saving transitions', 'server_check_required');
            }
            if (typeof body.cadence.tz === 'string') {
                try {
                    new Intl.DateTimeFormat('en', { timeZone: body.cadence.tz });
                }
                catch {
                    fail('/cadence/tz', 'must be a valid IANA time zone');
                }
            }
        }
    }
}
function hasNumericSupply(request) {
    // A standard number (ERC-20) or a decimals/chain count is not a supply.
    const text = request.replace(/\bERC[ -]?20\b/gi, 'token');
    return /\bsupply\s*(?:of|is|:|=)?\s*\d/i.test(text)
        || /\b(?:mint(?:ed)?|issue(?:d)?)\s+\d/i.test(text)
        || /(?<![\w-])\d[\d,._]*(?:\s+(?:billion|million|thousand))?\s+tokens?\b/i.test(text)
        || /(?<![\w-])\d[\d,._]*(?:\s+(?:billion|million|thousand))?\s+[A-Z]{2,10}\b/.test(text);
}
function launchTokenMismatch(objective) {
    const supply = /\b(?:total\s+|fixed\s+)?supply\s*(?:of|is|:|=)?\s*(\d[\d,._]*)(?:\s*(billion|million|thousand))?\b/i.exec(objective);
    if (supply) {
        const quantity = Number(supply[1].replace(/[,_]/g, '')) * ({ billion: 1e9, million: 1e6, thousand: 1e3 }[supply[2]?.toLowerCase()] ?? 1);
        if (Number.isFinite(quantity) && quantity !== 1e9)
            return true;
    }
    const decimals = /\b(\d+)\s+decimals?\b|\bdecimals?\s*(?::|=|of|is)?\s*(\d+)\b/i.exec(objective);
    if (decimals && Number(decimals[1] ?? decimals[2]) !== 18)
        return true;
    return /\b(?:transfer|transaction)\s+(?:fees?|tax(?:es)?)\b|\b(?:fees?|tax(?:es)?)\s+on\s+(?:every\s+)?transfers?\b/i.test(objective)
        && !/\b(?:no|without)\s+(?:transfer|transaction)\s+(?:fees?|tax(?:es)?)\b/i.test(objective);
}
