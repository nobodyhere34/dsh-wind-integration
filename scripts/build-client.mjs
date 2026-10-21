#!/usr/bin/env node
// Build the client bundle for dsh-wind-integration: esbuild (resolved from the
// dsh checkout) bundles client/index.tsx into an IIFE that the Harness module
// loader runs. React and react/jsx-runtime stay external (the client baseline
// seeds them); every @deepseek-ai import would need dsh.client.external row
// entries instead. Emits lib/client.js + a minimal lib/client.d.ts.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const checkout = process.env.DSH_CHECKOUT
if (!checkout) {
  console.error('build-client: DSH_CHECKOUT is required (path to a dsh checkout with esbuild)')
  process.exit(1)
}

/** Resolve esbuild's main.js through the checkout, including pnpm store layouts. */
function resolveEsbuildMain() {
  const candidates = [
    join(checkout, 'node_modules/esbuild/lib/main.js'),
    join(checkout, 'node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/lib/main.js'),
    join(checkout, 'node_modules/.pnpm/esbuild@0.25.0/node_modules/esbuild/lib/main.js'),
    join(checkout, 'node_modules/.pnpm/esbuild@*/node_modules/esbuild'),
  ]
  for (const c of candidates) {
    if (c.endsWith('@*/node_modules/esbuild')) continue
    if (existsSync(c)) return c
  }
  // last resort: scan the pnpm store
  const dir = join(checkout, 'node_modules/.pnpm')
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!name.startsWith('esbuild@')) continue
      const main = join(dir, name, 'node_modules/esbuild/lib/main.js')
      if (existsSync(main)) return main
    }
  }
  throw new Error('build-client: esbuild not found under ' + checkout)
}

const { build } = await import(pathToFileURL(resolveEsbuildMain()).href)

const result = await build({
  entryPoints: [join(root, 'client/index.tsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  globalName: 'windClientBundle',
  external: ['react', 'react/jsx-runtime'],
  jsx: 'automatic',
  jsxImportSource: 'react',
  write: false,
  logLevel: 'warning',
})

const body = result.outputFiles[0].text
if (!/var windClientBundle =/.test(body)) {
  console.error('build-client: unexpected esbuild output (missing globalName assignment)')
  process.exit(1)
}

const wrapper =
  'window.__ModuleLoader__.load({\n' +
  '\tid: "@dsh-external/dsh-wind-integration",\n' +
  '\tfactory: (require) => {\n' +
  '\t\t' + body + '\n' +
  '\t\treturn windClientBundle;\n' +
  '\t}\n' +
  '});\n'

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib/client.js'), wrapper)
writeFileSync(join(root, 'lib/client.d.ts'), [
  "export declare const name = 'dsh-wind-client';",
  'export declare const inject: string[];',
  "export declare const NS = 'wind';",
  'export interface WindCardProps { t?: (key: string, vars?: Record<string, string>) => string }',
  'export declare function apply(ctx: unknown): void;',
  '',
].join('\n'))
console.log('client bundle: lib/client.js (' + wrapper.length + ' bytes)')
