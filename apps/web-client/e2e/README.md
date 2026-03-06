# UI Smoke Tests

Headless browser smoke coverage for the web MVP lives here.

Current scope:
- drag-and-drop deployment from roster to battlefield;
- rejection of drops outside the active hex grid;
- screenshot capture after successful battlefield deployment.

Artifacts are written to:
- `artifacts/ui/screenshots`
- `artifacts/ui/playwright-report`
- `artifacts/ui/test-results`

Run locally from the repository root:

```bash
npm run test:ui
```
