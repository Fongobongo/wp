import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type BattleDebugState = {
  statusText: string;
  tiles: Array<{
    q: number;
    r: number;
    centerX: number;
    centerY: number;
  }>;
  units: Array<{
    id: string;
    q: number;
    r: number;
    rootX: number;
    rootY: number;
    tileCenterX: number;
    tileCenterY: number;
  }>;
};

declare global {
  interface Window {
    __WAR_PROTOCOL_E2E__?: {
      getBattleDebugState: () => BattleDebugState | null;
    };
  }
}

const screenshotDir = path.resolve(process.cwd(), "artifacts/ui/screenshots");

async function readDebugState(page: Page): Promise<BattleDebugState> {
  const state = await page.evaluate(() => window.__WAR_PROTOCOL_E2E__?.getBattleDebugState() ?? null);
  expect(state).not.toBeNull();
  return state as BattleDebugState;
}

async function dragCardToTile(
  page: Page,
  unitId: string,
  q: number,
  r: number
): Promise<void> {
  const state = await readDebugState(page);
  const tile = state.tiles.find((candidate) => candidate.q === q && candidate.r === r);
  expect(tile, `Missing tile (${q}, ${r})`).toBeTruthy();
  const boardBox = await page.getByTestId("battle-board").boundingBox();
  expect(boardBox).not.toBeNull();

  await dispatchHtml5Drag(page, unitId, boardBox!.x + tile!.centerX, boardBox!.y + tile!.centerY);
}

async function dispatchHtml5Drag(
  page: Page,
  unitId: string,
  clientX: number,
  clientY: number
): Promise<void> {
  await page.evaluate(
    ({ unitId: sourceUnitId, clientX: dropClientX, clientY: dropClientY }) => {
      const source = document.querySelector(`[data-testid="unit-card-${sourceUnitId}"]`);
      const target = document.querySelector('[data-testid="battle-board"]');
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
        throw new Error("Drag source or board target is missing.");
      }

      const sourceRect = source.getBoundingClientRect();
      const sourceClientX = sourceRect.left + sourceRect.width / 2;
      const sourceClientY = sourceRect.top + sourceRect.height / 2;
      const dataTransfer = new DataTransfer();

      source.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: sourceClientX,
          clientY: sourceClientY
        })
      );
      target.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropClientX,
          clientY: dropClientY
        })
      );
      target.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropClientX,
          clientY: dropClientY
        })
      );
      target.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropClientX,
          clientY: dropClientY
        })
      );
      source.dispatchEvent(
        new DragEvent("dragend", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: dropClientX,
          clientY: dropClientY
        })
      );
    },
    {
      unitId,
      clientX,
      clientY
    }
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("battle-board")).toBeVisible();
  await page.waitForFunction(() => {
    const state = window.__WAR_PROTOCOL_E2E__?.getBattleDebugState();
    return Boolean(state && state.tiles.length > 0);
  });
});

test("deploys multiple units with drag and drop, keeps them centered, and captures screenshots", async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  await dragCardToTile(page, "u-vanguard", 0, 6);
  await dragCardToTile(page, "u-bastion", 1, 6);
  await dragCardToTile(page, "u-ranger", 2, 6);

  await expect
    .poll(async () => {
      const state = await readDebugState(page);
      return state.units.map((unit) => `${unit.id}:${unit.q},${unit.r}`).sort();
    })
    .toEqual(["u-bastion:1,6", "u-ranger:2,6", "u-vanguard:0,6"]);

  const state = await readDebugState(page);
  for (const unit of state.units) {
    expect(Math.abs(unit.rootX - unit.tileCenterX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(unit.rootY - unit.tileCenterY)).toBeLessThanOrEqual(0.5);
  }

  const boardPath = path.join(screenshotDir, "drag-drop-board.png");
  const pagePath = path.join(screenshotDir, "drag-drop-page.png");
  const boardBox = await page.getByTestId("battle-board").boundingBox();
  expect(boardBox).not.toBeNull();

  await page.screenshot({
    path: boardPath,
    clip: {
      x: boardBox!.x,
      y: boardBox!.y,
      width: boardBox!.width,
      height: boardBox!.height
    }
  });
  await page.screenshot({ path: pagePath, fullPage: true });

  await testInfo.attach("drag-drop-board", {
    path: boardPath,
    contentType: "image/png"
  });
  await testInfo.attach("drag-drop-page", {
    path: pagePath,
    contentType: "image/png"
  });
});

test("rejects drops outside the active hex grid", async ({ page }) => {
  const boardBox = await page.getByTestId("battle-board").boundingBox();
  expect(boardBox).not.toBeNull();

  await dispatchHtml5Drag(page, "u-medic", boardBox!.x + 24, boardBox!.y + 574);

  await expect
    .poll(async () => {
      const state = await readDebugState(page);
      return {
        deployedCount: state.units.length,
        statusText: state.statusText
      };
    })
    .toEqual({
      deployedCount: 0,
      statusText: "Drop target is outside battlefield."
    });
});
