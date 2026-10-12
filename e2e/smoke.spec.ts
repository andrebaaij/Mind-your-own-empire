import { expect, type Page, test } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("start a game from the menu and build a solar panel", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto("/");
  await page.getByLabel("Mind's name").fill("Tester");
  await page.locator('label.swatch[title="Green"]').click();
  await expect(page.getByRole("radio", { name: "Green" })).toBeChecked();
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page).toHaveURL(/game\.html\?name=Tester&color=green&seed=1500/);
  await expect(page.locator("#message")).toHaveText("Welcome Tester, good luck!");
  await expect(page.locator("#iron")).toHaveText("100,000");
  await expect(page.locator("#energy")).toHaveText("0");

  const canvas = page.locator("#game canvas");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas has no size");

  // Build a solar panel just below the Mind.
  await page.getByRole("button", { name: "Solar" }).click();
  await expect(page.getByRole("button", { name: "Solar" })).toHaveAttribute("aria-pressed", "true");
  await page.mouse.click(box.width / 2 - 150, box.height / 2 + 150);

  await expect(page.locator("#iron")).toHaveText("90,000");
  await expect(page.locator("#energy")).toHaveText("+2");
  await expect(page.getByRole("button", { name: "Solar" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  expect(errors).toEqual([]);
});

test("pause and resume with the keyboard", async ({ page }) => {
  await page.goto("/game.html");
  await expect(page.locator("#iron")).toHaveText("100,000");

  await page.keyboard.press("p");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the game canvas renders the world", async ({ page }) => {
  await page.goto("/game.html");
  await expect(page.locator("#iron")).toHaveText("100,000");

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
  await expect(page.locator("#iron")).toHaveText("100,000");
  const solar = page.getByRole("button", { name: /Solar array/ });
  const drone = page.getByRole("button", { name: /Worker drone/ });

  await page.keyboard.press("1");
  await expect(solar).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("2");
  await expect(solar).toHaveAttribute("aria-pressed", "false");
  await expect(drone).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(drone).toHaveAttribute("aria-pressed", "false");
});
