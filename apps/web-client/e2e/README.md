# UI Smoke Tests

Headless browser smoke coverage for the web MVP lives here.

Current scope:
- rendering of a 23-hex battlefield with row lengths `5 / 4 / 5 / 4 / 5`;
- row-offset alignment of odd rows, so the board follows the intended `5 / 4 / 5 / 4 / 5` shape;
- rendering of 5 reserve unit cards;
- canceling an active placement selection;
- resetting the current deployment state after units are placed;
- keeping all free neighboring hexes highlighted after one hex becomes occupied;
- drag-and-drop deployment from the reserve card into an empty battlefield hex;
- rejection of drops outside the active grid;
- screenshot capture after successful deployment;
- pixel-based checks that the rendered unit blob stays centered inside the target hex polygon.

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
