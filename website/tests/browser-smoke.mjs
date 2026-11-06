// Fixture-driven browser acceptance. No hosted writes or real user sessions.
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { PDFDocument } from "pdf-lib";

const port = 4179,
  origin = `http://127.0.0.1:${port}`;
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const id = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const today = new Date().toISOString().slice(0, 10);
const day = (offset) =>
  new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10);
const questions = [
  "Should public transport be free in every city?",
  "Would a four-day workweek make life better?",
  "Should schools teach everyday money skills?",
];
const results = questions.map((q, i) => ({
  id: id(i + 1),
  question_text: q,
  asked_on: day(-i - 1),
  source_language: "en",
  yes_count: 12480 - i * 3400,
  no_count: 5670 + i * 1000,
  total_votes: 18150 - i * 2400,
  result: i === 2 ? "NO" : "YES",
  finalized_at: `${day(-i)}T00:00:00Z`,
}));
let requestLog = [],
  failBrewing = false,
  unavailable = false;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Await server readiness. */
    }
    if (attempt === 99) throw new Error("Vite did not start.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await mkdir("test-results", { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
    locale: "en-GB",
  });
  const page = await context.newPage();
  const errors = [];
  page.setDefaultTimeout(15000);
  await page.clock.install();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    requestLog.push(url);
    let data;
    if (url.pathname === "/api/config")
      data = { playStoreUrl: null, appStoreUrl: null, contactEmail: null };
    if (url.pathname === "/api/today")
      data = {
        id: id(10),
        question_text: "Should every city have more spaces to slow down?",
        asked_on: today,
        source_language: "en",
        server_time: new Date().toISOString(),
        voting_closes_at: `${day(1)}T00:00:00Z`,
      };
    if (url.pathname === "/api/results")
      data = { items: results, next_cursor: null };
    if (url.pathname === "/api/brewing") {
      if (failBrewing)
        return route.fulfill({
          status: 503,
          json: {
            error: "Questions could not be loaded. Please try again shortly.",
          },
        });
      data = {
        items: questions.map((q, i) => ({
          id: id(i + 20),
          question_text: q,
          created_at: `${day(-i)}T09:15:00Z`,
          upvote_count: 142 + i * 70,
        })),
        next_cursor: url.searchParams.has("cursor") ? null : "fixture-cursor",
      };
    }
    if (url.pathname === "/api/search")
      data = [
        {
          id: id(1),
          question_text: "Should public transport be free in every city?",
          destination: "past-results",
        },
      ];
    if (url.pathname === "/api/question")
      data = unavailable
        ? null
        : {
            ...results[0],
            question_text:
              "क्या शहरों में सार्वजनिक परिवहन मुफ़्त होना चाहिए? <script>bad()</script>",
            destination: "past-results",
          };
    await route.fulfill({
      json: { data, fetched_at: new Date().toISOString() },
    });
  });
  await page.goto(origin);
  await page
    .getByRole("heading", {
      name: "Should every city have more spaces to slow down?",
    })
    .waitFor();
  await page.getByRole("heading", { name: questions[0] }).waitFor();
  assert.equal(await page.locator('a[href*="apps.apple.com"]').count(), 0);
  const homeAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    homeAudit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
  );
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Brewing", exact: true }).click();
  await page.getByRole("heading", { name: "What’s brewing?" }).waitFor();
  await page.getByLabel("Sort by").selectOption("newest");
  await page.getByLabel("Submitted").selectOption("today");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByText("3 questions loaded").waitFor();
  assert.ok(
    requestLog.some(
      (u) =>
        u.pathname === "/api/brewing" &&
        u.searchParams.get("sort") === "newest" &&
        u.searchParams.get("filter") === "today",
    ),
  );
  await page.getByRole("button", { name: "Explore more" }).click();
  await page.getByText("3 questions loaded", { exact: true }).waitFor(); // Deduplicated retried page.
  await page.getByRole("button", { name: "Switch to grid view" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Switch to list view" }).waitFor();
  await page.getByText("3 questions loaded", { exact: false }).waitFor();
  const brewAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    brewAudit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
  );
  await page.screenshot({
    path: "test-results/brewing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Past results", exact: true }).click();
  await page.getByText("3 results loaded", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Report of loaded results" }).click();
  await page.getByRole("dialog", { name: "Your results report" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/results.pdf");
  const pdf = await PDFDocument.load(
    await readFile("test-results/results.pdf"),
  );
  assert.equal(pdf.getPageCount(), 3);
  assert.match(pdf.getTitle(), /Pulse/);
  await page.getByRole("button", { name: "Close report" }).click();
  await page
    .getByRole("button", {
      name: "Open display and question language settings",
    })
    .click();
  await page
    .getByLabel("Question language", { exact: true })
    .selectOption("hi");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByText("3 results loaded", { exact: true }).waitFor();
  assert.ok(
    requestLog.some(
      (u) =>
        u.pathname === "/api/results" &&
        u.searchParams.get("language") === "hi",
    ),
  );
  await page
    .getByLabel("Search public questions", { exact: true })
    .fill("transport");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.locator(".search-hits a").first().click();
  await page.getByRole("region", { name: "Shared question" }).waitFor();
  assert.equal(await page.locator(".selected-question script").count(), 0);
  assert.match(
    await page.locator(".selected-question h3").textContent(),
    /<script>/,
  );
  const nonLatin = page.waitForEvent("download");
  await page.locator(".selected-question [data-report]").click();
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await (await nonLatin).saveAs("test-results/hindi-result.pdf");
  await page.getByRole("button", { name: "Close report" }).click();
  unavailable = true;
  await page.reload();
  await page
    .getByRole("heading", { name: "This question is unavailable." })
    .waitFor();
  unavailable = false;
  await page.goto(`${origin}/?tab=brewing`);
  await page.getByText("3 questions loaded", { exact: false }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/brewing-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Open display and question language settings",
    })
    .click();
  await page.getByLabel("Larger text", { exact: true }).check();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Close settings" }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const mobileAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    mobileAudit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
  );
  await page.screenshot({
    path: "test-results/brewing-mobile-dark-large.png",
    fullPage: true,
  });
  failBrewing = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("heading", { name: "Let’s try that again." }).waitFor();
  failBrewing = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("3 questions loaded", { exact: false }).waitFor();
  assert.deepEqual(errors, []);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  ) {
    await page.screenshot({
      path: "test-results/overflow-200.png",
      fullPage: true,
    });
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 20)
          .map((el) => ({
            tag: el.tagName,
            className: el.className,
            right: el.getBoundingClientRect().right,
          })),
      ),
    );
  }
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "200% text should not overflow",
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  const beforeRefresh = requestLog.filter(
    (u) => u.pathname === "/api/brewing",
  ).length;
  const midnightRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/brewing",
  );
  await page.clock.setSystemTime(Date.parse(`${day(1)}T00:00:01Z`));
  await page.clock.runFor(15000);
  await midnightRequest;
  await page.getByText("3 questions loaded", { exact: false }).waitFor();
  assert.ok(
    requestLog.filter((u) => u.pathname === "/api/brewing").length >
      beforeRefresh,
    "Brewing refreshes at UTC midnight without visiting Today",
  );
  assert.ok(requestLog.every((u) => u.pathname.startsWith("/api/")));
  console.log(
    "Browser acceptance passed: responsive browsing, filters, pagination, stored view, language, search, hidden/XSS content, PDF downloads, recovery; axe clean on desktop/home/Brewing and mobile dark large text.",
  );
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
}
