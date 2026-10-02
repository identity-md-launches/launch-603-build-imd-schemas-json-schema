/** Minimal build-time declarations; there are no external Node type dependencies. */
declare function require(path: string): any;
declare const __dirname: string;
declare const Buffer: { byteLength(value: string, encoding?: string): number };
