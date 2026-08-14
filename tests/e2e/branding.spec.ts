import { expect, test } from "@playwright/test";

interface WebManifestIcon {
  src: string;
  sizes: string;
  type: string;
}

interface WebManifest {
  name: string;
  short_name: string;
  theme_color: string;
  icons: WebManifestIcon[];
}

const pngIcons = [
  { path: "/icon.png", size: 648 },
  { path: "/android-chrome-192x192.png", size: 192 },
  { path: "/android-chrome-512x512.png", size: 512 },
  { path: "/apple-touch-icon.png", size: 180 },
  { path: "/favicon-16x16.png", size: 16 },
  { path: "/favicon-32x32.png", size: 32 },
];

test.describe("Tow branding", () => {
  test("home page presents the Tow product identity", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Tow");
    await expect(page.getByRole("link", { name: /Tow logo Tow/ }))
      .toBeVisible();
    await expect(page.locator("main").getByRole("heading", { name: "Tow" }))
      .toHaveCount(1);
    await expect(page.getByText("STEADY HOUSEHOLD MANAGEMENT")).toBeVisible();
    await expect(page.getByRole("button", { name: "New Chore" })).toBeVisible();
    await expect(page.getByAltText("Tow logo")).toHaveCount(1);
    await expect(page.getByText(/Chores App|My Chores/)).toHaveCount(0);
  });

  test("login page keeps the shared Tow navigation", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: /Tow logo Tow/ }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: /Tow logo Tow/ }))
      .toHaveAttribute("href", "/");
    await expect(page.getByRole("heading", { name: "Tow" })).toHaveCount(2);
    await expect(page.getByText(/Chores App/)).toHaveCount(0);
  });

  test("manifest advertises Tow with the app theme color and icons", async ({ request }) => {
    const response = await request.get("/manifest.json");
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json() as WebManifest;
    expect(manifest.name).toBe("Tow");
    expect(manifest.short_name).toBe("Tow");
    expect(manifest.theme_color).toBe("#005f6a");
    expect(manifest.icons).toEqual([
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ]);
  });

  test("linked public icon assets are available at their declared sizes", async ({ page, request }) => {
    for (const icon of pngIcons) {
      const response = await request.get(icon.path);
      expect(response.ok(), `${icon.path} should load`).toBeTruthy();
      expect(response.headers()["content-type"]).toContain("image/png");
    }

    const faviconResponse = await request.get("/favicon.ico");
    expect(faviconResponse.ok()).toBeTruthy();
    expect(faviconResponse.headers()["content-type"]).toContain("image/x-icon");

    await page.goto("/");
    const dimensions = await page.evaluate(async (icons) => {
      return await Promise.all(
        icons.map((icon) =>
          new Promise<{ path: string; width: number; height: number }>(
            (resolve, reject) => {
              const image = new Image();
              image.onload = () =>
                resolve({
                  path: icon.path,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                });
              image.onerror = () =>
                reject(new Error(`Could not load ${icon.path}`));
              image.src = icon.path;
            },
          )
        ),
      );
    }, pngIcons);

    expect(dimensions).toEqual(pngIcons.map((icon) => ({
      path: icon.path,
      width: icon.size,
      height: icon.size,
    })));
  });
});
