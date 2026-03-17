import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const external = ['@deck.gl/core', 'zod', 'zod-to-json-schema']; // dependencies should not be bundled

// Plugin to create package.json in dist/cjs
const createCjsPackageJson = () => ({
  name: 'create-cjs-package-json',
  generateBundle() {
    const pkgJsonPath = 'dist/cjs/package.json';
    mkdirSync(dirname(pkgJsonPath), { recursive: true });
    writeFileSync(pkgJsonPath, JSON.stringify({ type: 'commonjs' }, null, 2));
  }
});

// Entry points for main and subpath exports
const entryPoints = {
  'index': 'src/index.ts',
  'definitions/index': 'src/definitions/index.ts',
  'executors/index': 'src/executors/index.ts',
  'schemas/index': 'src/schemas/index.ts',
  'converters/index': 'src/converters/index.ts',
  'prompts/index': 'src/prompts/index.ts',
};

export default [
  // ESM build
  {
    input: entryPoints,
    output: {
      dir: 'dist/esm',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'src',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      json(),
      typescript({
        declaration: true,
        outDir: 'dist/esm',
        rootDir: 'src'
      })
    ],
    external
  },
  // CJS build
  {
    input: entryPoints,
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      resolve(),
      commonjs(),
      json(),
      typescript({
        declaration: false,
        declarationMap: false,
        outDir: 'dist/cjs',
        rootDir: 'src'
      }),
      createCjsPackageJson()
    ],
    external
  }
];
