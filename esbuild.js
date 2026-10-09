const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')
const test = process.argv.includes('--test')

// jsonc-parser's UMD build uses a dynamic require esbuild cannot follow — bundle its ESM build instead.
const mainFields = ['module', 'main']

const shared = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  external: ['vscode'],
  mainFields,
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
}

const targets = [
  // Desktop VS Code
  { ...shared, platform: 'node', target: 'node18', outfile: 'dist/extension.js' },
  // vscode.dev / github.dev
  { ...shared, platform: 'browser', target: 'es2022', outfile: 'dist/web/extension.js' },
]

// Unit tests cover src/core only (no `vscode` dependency) and run on `node --test`.
function testTarget() {
  const entryPoints = fs
    .readdirSync('test')
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => path.join('test', f))
  return {
    entryPoints,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    outdir: 'out-test',
    mainFields,
    sourcemap: true,
    logLevel: 'warning',
  }
}

const integration = process.argv.includes('--integration')

async function main() {
  if (test) {
    fs.rmSync('out-test', { recursive: true, force: true })
    await esbuild.build(testTarget())
    return
  }
  if (integration) {
    await esbuild.build({
      entryPoints: ['test/integration/suite.ts'],
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'node18',
      external: ['vscode'],
      mainFields,
      outfile: 'out-test/integration/suite.js',
      logLevel: 'warning',
    })
    return
  }

  const contexts = await Promise.all(targets.map((t) => esbuild.context(t)))
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()))
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()))
    await Promise.all(contexts.map((ctx) => ctx.dispose()))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
