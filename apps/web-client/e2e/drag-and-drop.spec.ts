import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { PNG } from "pngjs";

type BattleDebugState = {
  statusText: string;
  tiles: Array<{
    q: number;
    r: number;
    centerX: number;
    centerY: number;
    vertices: Array<{
      x: number;
      y: number;
    }>;
  }>;
  units: Array<{
    id: string;
    color: number;
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
const UNIT_ID = "u-vanguard";
const TARGET_TILE = { q: 1, r: 1 } as const;

test.describe.configure({ timeout: 180_000 });

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function colorNumberToRgb(color: number): RgbColor {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff
  };
}

function pointInsidePolygon(
  x: number,
  y: number,
  vertices: Array<{ x: number; y: number }>
): boolean {
  let inside = false;
  let previousIndex = vertices.length - 1;

  for (let currentIndex = 0; currentIndex < vertices.length; currentIndex += 1) {
    const current = vertices[currentIndex];
    const previous = vertices[previousIndex];
    const intersects =
      current.y > y !== previous.y > y &&
      x <
        ((previous.x - current.x) * (y - current.y)) /
          ((previous.y - current.y) + Number.EPSILON) +
          current.x;

    if (intersects) {
      inside = !inside;
    }

    previousIndex = currentIndex;
  }

  return inside;
}

function pixelIndex(png: PNG, x: number, y: number): number {
  return (png.width * y + x) * 4;
}

function colorDistance(left: RgbColor, right: RgbColor): number {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function findUnitBlob(
  png: PNG,
  expectedCenter: { x: number; y: number },
  targetColor: RgbColor
): {
  centroidX: number;
  centroidY: number;
  pixels: Array<{ x: number; y: number }>;
} {
  const searchRadius = 44;
  const pixels: Array<{ x: number; y: number }> = [];
  let weightedX = 0;
  let weightedY = 0;

  const minX = Math.max(0, Math.floor(expectedCenter.x - searchRadius));
  const maxX = Math.min(png.width - 1, Math.ceil(expectedCenter.x + searchRadius));
  const minY = Math.max(0, Math.floor(expectedCenter.y - searchRadius));
  const maxY = Math.min(png.height - 1, Math.ceil(expectedCenter.y + searchRadius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const offset = pixelIndex(png, x, y);
      const alpha = png.data[offset + 3];
      if (alpha < 180) {
        continue;
      }

      const pixelColor = {
        r: png.data[offset],
        g: png.data[offset + 1],
        b: png.data[offset + 2]
      };

      if (colorDistance(pixelColor, targetColor) > 70) {
        continue;
      }

      pixels.push({ x, y });
      weightedX += x;
      weightedY += y;
    }
  }

  expect(pixels.length).toBeGreaterThan(1200);

  return {
    centroidX: weightedX / pixels.length,
    centroidY: weightedY / pixels.length,
    pixels
  };
}

async function captureCanvas(page: Page): Promise<{
  buffer: Buffer;
  box: { x: number; y: number; width: number; height: number };
}> {
  const canvas = page.locator(".battle-canvas canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const buffer = await page.screenshot({
    clip: {
      x: box!.x,
      y: box!.y,
      width: box!.width,
      height: box!.height
    }
  });

  return { buffer, box: box! };
}

async function readDebugState(page: Page): Promise<BattleDebugState> {
  const state = await page.evaluate(() => window.__WAR_PROTOCOL_E2E__?.getBattleDebugState() ?? null);
  expect(state).not.toBeNull();
  return state as BattleDebugState;
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
  await page.waitForFunction(
    () => {
      const state = window.__WAR_PROTOCOL_E2E__?.getBattleDebugState();
      return Boolean(state && state.tiles.length === 4);
    },
    undefined,
    { timeout: 120_000 }
  );
});

test("deploys the only unit into the selected grid hex", async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true });

  const initialState = await readDebugState(page);
  expect(initialState.board.cols).toBe(2);
  expect(initialState.board.rows).toBe(2);
  expect(initialState.tiles).toHaveLength(4);

  const tile = initialState.tiles.find(
    (candidate) => candidate.q === TARGET_TILE.q && candidate.r === TARGET_TILE.r
  );
  expect(tile).toBeTruthy();

  const boardBox = await page.getByTestId("battle-board").boundingBox();
  expect(boardBox).not.toBeNull();

  await dispatchHtml5Drag(page, UNIT_ID, boardBox!.x + tile!.centerX, boardBox!.y + tile!.centerY);

  await expect
    .poll(async () => {
      const state = await readDebugState(page);
      return state.units.map((unit) => `${unit.id}:${unit.q},${unit.r}`);
    })
    .toEqual([`${UNIT_ID}:${TARGET_TILE.q},${TARGET_TILE.r}`]);

  const state = await readDebugState(page);
  const unit = state.units[0];
  expect(unit.rootX).toBeCloseTo(tile!.centerX, 1);
  expect(unit.rootY).toBeCloseTo(tile!.centerY, 1);
  expect(state.statusText).toBe(`Vanguard deployed to hex (${TARGET_TILE.q}, ${TARGET_TILE.r}).`);

  const boardPath = path.join(screenshotDir, "four-hex-board.png");
  const pagePath = path.join(screenshotDir, "four-hex-page.png");
  const { buffer: canvasImage, box: canvasBox } = await captureCanvas(page);
  fs.writeFileSync(boardPath, canvasImage);
  await page.screenshot({ path: pagePath, fullPage: true });

  const png = PNG.sync.read(canvasImage);
  const scaleX = png.width / canvasBox.width;
  const scaleY = png.height / canvasBox.height;
  const targetColor = colorNumberToRgb(unit.color);
  const blob = findUnitBlob(
    png,
    {
      x: unit.tileCenterX * scaleX,
      y: unit.tileCenterY * scaleY
    },
    targetColor
  );

  expect(Math.abs(blob.centroidX - unit.tileCenterX * scaleX)).toBeLessThanOrEqual(2);
  expect(Math.abs(blob.centroidY - unit.tileCenterY * scaleY)).toBeLessThanOrEqual(2);

  const scaledVertices = tile!.vertices.map((vertex) => ({
    x: vertex.x * scaleX,
    y: vertex.y * scaleY
  }));
  const insidePixels = blob.pixels.filter((pixel) =>
    pointInsidePolygon(pixel.x, pixel.y, scaledVertices)
  ).length;
  expect(insidePixels / blob.pixels.length).toBeGreaterThan(0.98);
});

test("rejects drops outside the four-hex grid", async ({ page }) => {
  const boardBox = await page.getByTestId("battle-board").boundingBox();
  expect(boardBox).not.toBeNull();

  await dispatchHtml5Drag(page, UNIT_ID, boardBox!.x + 18, boardBox!.y + 18);

  await expect
    .poll(async () => {
      const state = await readDebugState(page);
      return {
        unitCount: state.units.length,
        statusText: state.statusText
      };
    })
    .toEqual({
      unitCount: 0,
      statusText: "Drop target is outside the grid."
    });
});
