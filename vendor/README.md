# Vendored build and validation dependencies

These are ordinary repository files, not submodules or dependencies that must be fetched during installation. `npm run build` and `npm test` run offline without `node_modules`.

- `typescript/` contains the TypeScript **5.9.3** compiler and standard library declaration files needed to build `src/`.
- `ajv.cjs` contains Ajv **8.17.1**, `ajv-formats` **3.0.1** and their runtime dependencies, bundled from the upstream npm packages using esbuild **0.25.11**. It provides draft 2020-12 compilation and format assertions.
- [provenance.json](provenance.json) records each upstream package's version, source tarball URL, integrity string and SHA-256 digest. These URLs document origin; builds never fetch them.
- License files for the bundled packages are retained here as `*-LICENSE`; TypeScript's license and notices are retained with its compiler.

The bundler is not needed to build or test this project: the runtime bundle is already shipped. A dependency upgrade requires reviewing and replacing the vendored files and provenance, preserving licenses, and running the full test suite. The root lockfile intentionally has no registry dependencies because all required code is available here.
