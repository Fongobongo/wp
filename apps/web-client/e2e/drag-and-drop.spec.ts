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
const EDGE_PLACEMENTS = [
  { unitId: "u-vanguard", q: 7, r: 4 },
  { unitId: "u-bastion", q: 6, r: 6 },
  { unitId: "u-ranger", q: 5, r: 6 },
  { unitId: "u-arcanist", q: 7, r: 6 },
  { unitId: "u-medic", q: 7, r: 5 }
] as const;

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
  let j = vertices.length - 1;

  for (let i = 0; i < vertices.length; i += 1) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
    j = i;
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
  const searchRadius = 28;
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

  expect(pixels.length).toBeGreaterThan(500);

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

test("keeps rendered unit blobs inside the target edge hexes", async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  for (const placement of EDGE_PLACEMENTS) {
    await dragCardToTile(page, placement.unitId, placement.q, placement.r);
  }

  await expect
    .poll(async () => {
      const state = await readDebugState(page);
      return state.units.map((unit) => `${unit.id}:${unit.q},${unit.r}`).sort();
    })
    .toEqual([
      "u-arcanist:7,6",
      "u-bastion:6,6",
      "u-medic:7,5",
      "u-ranger:5,6",
      "u-vanguard:7,4"
    ]);

  const state = await readDebugState(page);
  for (const unit of state.units) {
    expect(Math.abs(unit.rootX - unit.tileCenterX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(unit.rootY - unit.tileCenterY)).toBeLessThanOrEqual(0.5);
  }

  const boardPath = path.join(screenshotDir, "drag-drop-board.png");
  const pagePath = path.join(screenshotDir, "drag-drop-page.png");
  const { buffer: canvasImage, box: canvasBox } = await captureCanvas(page);
  fs.writeFileSync(boardPath, canvasImage);
  await page.screenshot({ path: pagePath, fullPage: true });

  const png = PNG.sync.read(canvasImage);
  const scaleX = png.width / canvasBox.width;
  const scaleY = png.height / canvasBox.height;

  for (const unit of state.units) {
    const tile = state.tiles.find((candidate) => candidate.q === unit.q && candidate.r === unit.r);
    expect(tile, `Missing tile for ${unit.id}`).toBeTruthy();

    const blob = findUnitBlob(
      png,
      {
        x: unit.tileCenterX * scaleX,
        y: unit.tileCenterY * scaleY
      },
      colorNumberToRgb(unit.color)
    );

    expect(Math.abs(blob.centroidX - unit.tileCenterX * scaleX)).toBeLessThanOrEqual(3);
    expect(Math.abs(blob.centroidY - unit.tileCenterY * scaleY)).toBeLessThanOrEqual(3);

    const scaledVertices = tile!.vertices.map((vertex) => ({
      x: vertex.x * scaleX,
      y: vertex.y * scaleY
    }));

    const pixelsOutside = blob.pixels.filter(
      (pixel) => !pointInsidePolygon(pixel.x, pixel.y, scaledVertices)
    ).length;

    expect(pixelsOutside / blob.pixels.length).toBeLessThanOrEqual(0.03);
  }

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
