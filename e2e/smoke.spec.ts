import { expect, type Page, test } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("explore a world from the menu and build a collector", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto("/");
  await page.getByLabel("Mind's name").fill("Tester");
  await page.locator('label.swatch[title="Green"]').click();
  await expect(page.getByRole("radio", { name: "Green" })).toBeChecked();
  await page.getByRole("button", { name: "Explore" }).click();

  await expect(page).toHaveURL(/game\.html\?name=Tester&color=green&seed=1500&mission=survey/);
  await expect(page.locator("#message-text")).toHaveText(/Survey mode/);
  await expect(page.locator("#message-speaker")).toHaveText("Tester");
  await expect(page.locator("#iron")).toHaveText("150");
  await expect(page.locator("#energy")).toHaveText("+10");

  const canvas = page.locator("#game canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no size");

  // Place a collector just below the Mind.
  const collector = page.getByRole("button", { name: /Collector/ });
  await collector.click();
  await expect(collector).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(box.width / 2 - 150, box.height / 2 + 150);

  await expect(page.locator("#iron")).toHaveText("50");
  await expect(page.locator("#energy")).toHaveText("+13");
  await expect(collector).toHaveAttribute("aria-pressed", "false");

  expect(errors).toEqual([]);
});

test("start the campaign: briefing, then the first objective", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Arrived/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Arrived" })).toBeVisible();
  await dialog.getByRole("button", { name: "Begin" }).click();
  await expect(dialog).toBeHidden();

  const objectives = page.getByRole("region", { name: "Mission objectives" });
  await expect(objectives).toContainText("Mine iron and bring it home");
  await expect(objectives).toContainText("0 / 60");
  expect(errors).toEqual([]);
});

test("pause and resume with the keyboard", async ({ page }) => {
  await page.goto("/game.html");
  await expect(page.locator("#iron")).toHaveText("150");

  await page.keyboard.press("p");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the game canvas renders the world", async ({ page }) => {
  await page.goto("/game.html");
  await expect(page.locator("#iron")).toHaveText("150");

  // Sample a pixel left of centre: explored terrain, not the black void. A WebGL canvas can't be
  // read back directly, so decode a screenshot in the page instead.
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const png = await page.screenshot({
    clip: { x: viewport.width / 2 - 200, y: viewport.height / 2, width: 1, height: 1 },
  });
  const [r = 0, g = 0, b = 0] = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${base64}`)).blob(),
    );
    const context = new OffscreenCanvas(1, 1).getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, png.toString("base64"));

  expect(r + g + b).toBeGreaterThan(60);
});

test("number keys pick buildings from the build bar", async ({ page }) => {
  await page.goto("/game.html");
  await expect(page.locator("#iron")).toHaveText("150");
  const drone = page.getByRole("button", { name: /Worker drone/ });
  const collector = page.getByRole("button", { name: /Collector/ });

  await page.keyboard.press("1");
  await expect(drone).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("2");
  await expect(drone).toHaveAttribute("aria-pressed", "false");
  await expect(collector).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(collector).toHaveAttribute("aria-pressed", "false");
});

test("mission 4: run silent with R, shown in the stealth panel", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/game.html?mission=ah-company");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Begin" }).click();
  await expect(dialog).toBeHidden();

  const silent = page.getByRole("button", { name: /Run silent/ });
  await expect(silent).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("r");
  await expect(silent).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Mission objectives" })).toContainText(
    "Plant a decoy beacon",
  );
  await expect(page.getByRole("button", { name: /Decoy beacon/ })).toBeVisible();
  expect(errors).toEqual([]);
});
