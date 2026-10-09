# Publishing

The extension is published manually through the Marketplace web UI, same as the other
`studiomedio` extensions — no Personal Access Token, no CI.

## Release a new version

1. Bump `version` in `package.json` and add a matching entry to `CHANGELOG.md`.
2. Run the checks and build the package:

   ```bash
   npm run typecheck && npm test && npm run test:integration
   npm run package          # -> jsonery-<version>.vsix
   ```

3. Upload the `.vsix` at <https://marketplace.visualstudio.com/manage/publishers/studiomedio>:
   - **New** extension: **New extension → Visual Studio Code**, drop the `.vsix`.
   - **Update**: open the extension → **…** → **Update**, drop the new `.vsix`.
4. (Optional) Draft a GitHub Release tagged `vX.Y.Z` and attach the `.vsix`.

The listing goes live at `https://marketplace.visualstudio.com/items?itemName=studiomedio.jsonery`.

## Pre-flight checklist

- [ ] `npm run typecheck`, `npm test` and `npm run test:integration` pass.
- [ ] `version` bumped and `CHANGELOG.md` updated.
- [ ] `npx vsce ls` lists only `dist/`, `images/icon.png`, README, CHANGELOG, LICENSE and `package.json`.

## Testing the package locally

```bash
code --install-extension jsonery-<version>.vsix --force
```
