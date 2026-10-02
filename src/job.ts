import type { Issue } from './index';
const obj = (value: any): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function jobChecks(body: Record<string, any>, prefix: string, errors: Issue[], warnings: Issue[]): void {
  const fail = (path: string, message: string, code = 'invalid_input') => errors.push({code,path: prefix + path,message});
  const steps = Array.isArray(body.steps) ? body.steps : [];
  for (const [location, paths] of [['/paths',body.paths],...steps.map((step: any, i: number) => [`/steps/${i}/paths`,step?.paths])] as [string,unknown][]) {
    if (!Array.isArray(paths)) continue;
    const expandedCount = paths.reduce((count: number, path: unknown) => count + (typeof path === 'string' && !path.endsWith('/**') && !/(?:^|\/)[^/.][^/]*\.[^/.]+$/.test(path) ? 2 : 1), 0);
    if (expandedCount > 16) fail(location,'expected between 1 and 16 allowed paths after directory expansion','bad_path_count');
    paths.forEach((path: unknown, index: number) => {
      if (typeof path !== 'string') return;
      const normalized = path.replace(/\\/g,'/').replace(/^(\.\/)+/,'').replace(/\/+$/,'');
      if (normalized === '.git' || normalized.startsWith('.git/') || normalized === 'foundry.toml' || normalized === 'lib' || normalized.startsWith('lib/')) fail(`${location}/${index}`,`protected path: ${path}; .git, foundry.toml and lib are reserved`,'protected_path');
    });
  }
  steps.forEach((step: any, i: number) => {
    if (!obj(step)) return;
    if (body.shape !== 'dag') for (const field of ['key','dependsOn']) if (Object.hasOwn(step,field)) fail(`/steps/${i}/${field}`,'Explicit keys and dependencies require shape:dag','unplannable_steps');
    if (['gas-and-size-report','write-readme-and-docs','deploy-script'].includes(step.skill) && Object.hasOwn(step,'paths')) fail(`/steps/${i}/paths`,`${step.skill} steps must not name paths`,'unplannable_steps');
    if (step.skill === 'implement-one-contract' && (typeof step.variables?.contract !== 'string' || !step.variables.contract.trim())) fail(`/steps/${i}/variables/contract`,'is required for implement-one-contract');
    if (Array.isArray(step.acceptanceCriteria) && step.acceptanceCriteria.some((text: unknown) => typeof text === 'string' && /^(works|secure|good|correct|safe|best practices)[.!]?$/i.test(text.trim()))) warnings.push({code:'recheck_failed',path:prefix+`/steps/${i}/acceptanceCriteria`,message:'vague rules may cause recheck_failed or needs_revision; name observable behavior and evidence'});
    if (step.skill === 'adversarial-review' && /\b(?:failing|failed|broken)\s+tests?\b/i.test([body.objective,step.objective].filter(value => typeof value === 'string').join(' '))) warnings.push({code:'needs_revision',path:prefix+`/steps/${i}`,message:'asking adversarial-review for a failing test may be refused; assign implementation or test repair before independent review'});
  });
  if (Number.isInteger(body.panelSize) && Number.isInteger(body.panelQuorum) && body.panelQuorum > body.panelSize) fail('/panelQuorum','must be <= panelSize');
  if (body.shape !== 'dag' || !steps.length || !steps.every(obj)) return;
  const keys = steps.map((s: any) => s.key);
  if (!keys.every((k: unknown) => typeof k === 'string')) return;
  const seen = new Set<string>();
  keys.forEach((key: string, i: number) => {
    if (seen.has(key)) fail(`/steps/${i}/key`,'DAG step keys must be unique');
    seen.add(key);
  });
  const deps = new Map<string,string[]>();
  steps.forEach((step: any, i: number) => {
    if (!Array.isArray(step.dependsOn)) return;
    const values = step.dependsOn.filter((v: unknown) => typeof v === 'string');
    deps.set(step.key,values);
    if (new Set(values).size !== values.length) fail(`/steps/${i}/dependsOn`,'must not contain duplicate step keys');
    values.forEach((key: string) => { if (!seen.has(key)) fail(`/steps/${i}/dependsOn`,`unknown dependency step key: ${key}`); });
  });
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (key: string): boolean => {
    if (visiting.has(key)) return false;
    if (visited.has(key)) return true;
    visiting.add(key);
    for (const dependency of deps.get(key) || []) if (!visit(dependency)) return false;
    visiting.delete(key); visited.add(key); return true;
  };
  if (keys.some((key: string) => !visit(key))) fail('/steps','DAG must be acyclic (cycle or self-dependency found)');
  const dependedOn = new Set([...deps.values()].flat());
  if (keys.filter((key: string) => !dependedOn.has(key)).length !== 1) fail('/steps','DAG branches must join into one final step (one sink)');
}
export function workflowDag(draft: Record<string, any>, prefix: string, errors: Issue[]): void {
  if (draft.shape !== 'dag' || !Array.isArray(draft.steps) || !draft.steps.every(obj)) return;
  const steps: Record<string, any>[] = draft.steps;
  const review = steps.filter(s => s.skill === 'adversarial-review');
  const frontend = steps.filter(s => ['frontend-for-contract','build-website'].includes(s.skill));
  if (review.length === 0 || frontend.length !== 1 || !steps.every(step => typeof step.key === 'string')) return;
  const byKey = new Map(steps.map(s => [s.key,s]));
  const ancestors = (key: string, visited = new Set<string>()): Set<string> => {
    if (visited.has(key)) return visited;
    visited.add(key);
    const depends = byKey.get(key)?.dependsOn;
    if (Array.isArray(depends)) for (const dependency of depends) ancestors(dependency,visited);
    return visited;
  };
  const frontendAncestors = ancestors(frontend[0].key);
  const finalReview = review.find(candidate => {
    if (!frontendAncestors.has(candidate.key)) return false;
    const reviewed = ancestors(candidate.key);
    return steps.every(step => step === frontend[0] || reviewed.has(step.key));
  });
  if (!finalReview) errors.push({code:'invalid_input',path:prefix+'/steps',message:'every contract branch must reach a final adversarial-review, and the front end must depend on that review'});
}
