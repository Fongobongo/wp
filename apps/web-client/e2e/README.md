# UI Smoke Tests

Headless browser smoke coverage for the web MVP lives here.

Current scope:
- drag-and-drop deployment from the reserve card into the single valid battlefield hex;
- rejection of drops outside that hex;
- screenshot capture after successful deployment;
- pixel-based checks that the rendered unit blob stays centered inside the hex polygon.

Artifacts are written to:
- `artifacts/ui/screenshots`
- `artifacts/ui/playwright-report`
- `artifacts/ui/test-results`

Run locally from the repository root:

```bash
npm run test:ui
```

Run the same suite against production:

```bash
npm run test:ui:prod
```
