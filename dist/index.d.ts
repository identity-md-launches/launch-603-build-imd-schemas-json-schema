export declare const experimentalNotice = "Experimental, commissioned as a test of the IMD swarm. It may not work as described. Read the code, start with small amounts, no warranty.";
export declare const actionVersions: Readonly<{
    readonly 'job.open': "job-1";
    readonly 'job.continue': "job-1";
    readonly 'launch.open': "launch-1";
    readonly 'workflow.open': "workflow-1";
    readonly 'oracle.request': "oracle-1";
    readonly 'schedule.create': "schedule-1";
    readonly 'schedule.topup': "topup-1";
}>;
export type Action = keyof typeof actionVersions;
export interface Issue {
    code: string;
    path: string;
    message: string;
}
export interface ValidationResult {
    valid: boolean;
    action: string;
    version?: string;
    errors: Issue[];
    warnings: Issue[];
}
export interface ValidationOptions {
    version?: string;
}
export type JsonSchema = Record<string, any>;
export declare const knownRefusals: {
    code: string;
    cause: string;
    remedy: string;
    scope: string;
}[];
export declare const schemas: Readonly<Record<string, JsonSchema>>;
export declare function getSchema(action: string, version?: string): JsonSchema;
/** No coercion, defaults, network requests, payment or input mutation. */
export declare function validate(action: string, input: unknown, options?: ValidationOptions): ValidationResult;
