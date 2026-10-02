import type { Issue } from './index';
export declare function jobChecks(body: Record<string, any>, prefix: string, errors: Issue[], warnings: Issue[]): void;
export declare function workflowDag(draft: Record<string, any>, prefix: string, errors: Issue[]): void;
