/** Deterministic cadence checks; UTC calendar arithmetic is independent of the host timezone. */
export declare function intervalMinutes(value: string): number | undefined;
export declare function cronMinimumMinutes(cron: string): number;
