// Downloads an isolated VS Code into .vscode-test/ and runs the integration suite in it.
const path = require('path')
const { runTests } = require('@vscode/test-electron')

async function main() {
  // Set when launched from VS Code's own terminal/extension host; it would start the test instance as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE
  const root = path.resolve(__dirname, '../..')
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, 'out-test/integration/suite.js'),
    launchArgs: ['--disable-extensions', '--skip-welcome', '--skip-release-notes'],
  })
}

main().catch(() => process.exit(1))
