import test from "node:test";
import assert from "node:assert/strict";
import worker, { api, publicConfig } from "../worker/index.mjs";
const id = (index) =>
  `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
const env = {
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
const req = (path, options) =>
  new Request(`https://pulse.example/api/${path}`, options);
const row = (day, index = 1, yes = 60, no = 40) => ({
  question_id: id(index),
  question_text: `Question ${index}?`,
  source_language: "en",
  asked_on: day,
  yes_count: yes,
  no_count: no,
  total_votes: yes + no,
  result: yes === no ? "TIE" : yes > no ? "YES" : "NO",
  finalized_at: `${day}T23:59:59Z`,
});
const body = async (response) => (await response.json()).data;

test("website permits only public read routes and never forwards browser auth or private fields", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return Response.json({
      items: [
        {
          id: id(1),
          question_text: "Public?",
          created_at: "2026-11-05T10:00:00Z",
          upvote_count: "42",
          author_id: id(2),
          is_own: true,
          upvoted_today: true,
        },
      ],
      next_cursor: null,
    });
  };
  const response = await api(
    req("brewing", {
      headers: {
        Authorization: "Bearer private-user-token",
        Cookie: "session=secret",
      },
    }),
    env,
    fetcher,
  );
  assert.equal(response.status, 200);
  const data = await body(response);
  assert.deepEqual(Object.keys(data.items[0]).sort(), [
    "created_at",
    "id",
    "question_text",
    "upvote_count",
  ]);
  assert.equal(data.items[0].upvote_count, 42);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.headers.Cookie, undefined);
  assert.deepEqual(calls[0].options.headers, {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  });
  for (const method of ["POST", "PUT", "PATCH", "DELETE"])
    assert.equal(
      (await api(req("brewing", { method }), env, fetcher)).status,
      405,
    );
  assert.equal((await api(req("submit_vote"), env, fetcher)).status, 404);
  assert.equal(calls.length, 1);
});
test("invalid filters, dates and cursor scopes never reach Supabase", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw new Error("Unexpected fetch");
  };
  for (const path of [
    "brewing?sort=hot",
    "brewing?filter=mine",
    "brewing?cursor=invalid",
    "results?from=2026-02-30",
    "results?from=2026-11-06&to=2026-11-01",
    "results?minimum=-1",
    "results?outcome=PRIVATE",
    "today?language=xx",
    "question?id=not-a-uuid",
    "search?q=a",
  ]) {
    assert.equal((await api(req(path), env, fetcher)).status, 400, path);
  }
  assert.equal(calls, 0);
});
test("today excludes live totals and TTL cannot cross midnight UTC", async () => {
  const fetcher = async () =>
    Response.json([
      {
        id: id(1),
        question_text: "Today?",
        source_language: "en",
        asked_on: "2026-11-06",
        server_time: "2026-11-06T23:59:59Z",
        voting_closes_at: "2026-11-07T00:00:00Z",
        yes_count: 100,
        author_email: "secret@example.com",
      },
    ]);
  const response = await api(
    req("today"),
    env,
    fetcher,
    Date.parse("2026-11-06T23:59:59Z"),
  );
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(
    response.headers
      .get("Content-Security-Policy")
      .includes("frame-ancestors 'none'"),
    true,
  );
  const data = await body(response);
  assert.equal(data.yes_count, undefined);
  assert.equal(data.author_email, undefined);
  assert.equal(data.voting_closes_at, "2026-11-07T00:00:00Z");
  assert.equal(
    (await api(req("today"), env, async () => Response.json([]))).status,
    200,
  );
});
test("results use bounded keyset scanning without skipping unconsumed matches", async () => {
  const dates = Array.from({ length: 45 }, (_, i) =>
    new Date(Date.parse("2026-11-05") - i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const rows = dates.map((d, i) =>
    row(d, i + 1, i % 2 ? 40 : 60, i % 2 ? 60 : 40),
  );
  const calls = [];
  const fetcher = async (_, options) => {
    const p = JSON.parse(options.body);
    calls.push(p);
    return Response.json(
      rows
        .filter((r) => !p.p_before || r.asked_on < p.p_before)
        .slice(0, p.p_limit),
    );
  };
  const first = await body(await api(req("results?outcome=YES"), env, fetcher));
  assert.equal(first.items.length, 20);
  const second = await body(
    await api(
      req(`results?outcome=YES&cursor=${first.next_cursor}`),
      env,
      fetcher,
    ),
  );
  assert.deepEqual(
    [...first.items, ...second.items].map((r) => r.question_id ?? r.id),
    rows.filter((r) => r.result === "YES").map((r) => r.question_id),
  );
  assert.equal(second.next_cursor, null);
  assert.ok(calls.every((p) => p.p_limit === 20));
});
test("slow upstream calls crossing midnight are never cached as fresh next-day data", async () => {
  let ticks = 0;
  const response = await api(
    req("today"),
    env,
    async () => Response.json([]),
    () =>
      ticks++
        ? Date.parse("2026-11-07T00:00:03Z")
        : Date.parse("2026-11-06T23:59:58Z"),
  );
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("date range is inclusive and ends pagination at lower bound", async () => {
  const source = [
    row("2026-11-04"),
    row("2026-11-03", 2),
    row("2026-11-02", 3),
  ];
  let args;
  const response = await api(
    req("results?from=2026-11-03&to=2026-11-04"),
    env,
    async (_, options) => {
      args = JSON.parse(options.body);
      return Response.json(source);
    },
  );
  const data = await body(response);
  assert.equal(args.p_before, "2026-11-05");
  assert.deepEqual(
    data.items.map((r) => r.asked_on),
    ["2026-11-04", "2026-11-03"],
  );
  assert.equal(data.next_cursor, null);
});
test("sparse archive search is capped at three upstream requests and can continue", async () => {
  let calls = 0;
  const response = await api(req("results?q=unmatched"), env, async () => {
    calls++;
    return Response.json(
      Array.from({ length: 20 }, (_, i) =>
        row(
          new Date(Date.parse("2026-11-05") - ((calls - 1) * 20 + i) * 86400000)
            .toISOString()
            .slice(0, 10),
          i + 1,
        ),
      ),
    );
  });
  const data = await body(response);
  assert.equal(calls, 3);
  assert.deepEqual(data.items, []);
  assert.ok(data.next_cursor);
});
test("expired Brewing cursors offer refresh and retain no private fields in public responses", async () => {
  const response = await api(
    req("brewing"),
    env,
    async () => new Response("Internal SQL details", { status: 400 }),
  );
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /Refresh/);
});
test("inconsistent totals and upstream errors fail closed without leaking internals", async () => {
  const response = await api(req("results"), env, async () =>
    Response.json([{ ...row("2026-11-05"), total_votes: 999 }]),
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), /999|stack|SUPABASE/);
  const invalidConfig = await api(
    req("today"),
    { ...env, SUPABASE_PUBLISHABLE_KEY: "sb_secret_never_use" },
    async () => {
      throw new Error("Do not call");
    },
  );
  assert.equal(invalidConfig.status, 503);
});
test("only real configured store hosts are exposed; config never returns credentials", async () => {
  assert.deepEqual(
    publicConfig({
      ...env,
      PLAY_STORE_URL: "javascript:alert(1)",
      APP_STORE_URL: "https://apps.apple.com.evil.example/app",
      CONTACT_EMAIL: "<bad>",
    }),
    { playStoreUrl: null, appStoreUrl: null, contactEmail: null },
  );
  const data = await body(
    await api(req("config"), {
      ...env,
      PLAY_STORE_URL:
        "https://play.google.com/store/apps/details?id=com.pulse.worldtoday",
      CONTACT_EMAIL: "hello@example.com",
    }),
  );
  assert.equal(data.contactEmail, "hello@example.com");
  assert.equal(data.SUPABASE_PUBLISHABLE_KEY, undefined);
});
test("public shared question resolves with aggregates only and hidden content stays unavailable", async () => {
  const response = await api(req(`question?id=${id(1)}`), env, async () =>
    Response.json({
      ...row("2026-11-05"),
      id: id(1),
      text: "Resolved?",
      destination: "past-results",
      owner_id: id(2),
      result_id: id(3),
    }),
  );
  const data = await body(response);
  assert.equal(data.question_text, "Resolved?");
  assert.equal(data.total_votes, 100);
  assert.equal(data.owner_id, undefined);
  assert.equal(
    await body(
      await api(req(`question?id=${id(1)}`), env, async () =>
        Response.json(null),
      ),
    ),
    null,
  );
});
test("static outage fallback does not use Supabase and includes security headers", async () => {
  const response = await worker.fetch(
    new Request("https://pulse.example/"),
    { ASSETS: { fetch: async () => new Response("<h1>Pulse</h1>") } },
    {},
  );
  assert.equal(await response.text(), "<h1>Pulse</h1>");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
});
test("cached API responses carry a fresh edge clock and HEAD has no response body", async () => {
  const original = globalThis.caches;
  globalThis.caches = {
    default: {
      match: async () =>
        new Response('{"data":null}', {
          headers: {
            "X-Pulse-Server-Time": "2000-01-01T00:00:00Z",
            "Cache-Control": "public, max-age=20",
          },
        }),
    },
  };
  try {
    const response = await worker.fetch(
      req("today", { method: "HEAD" }),
      env,
      {},
    );
    assert.equal(await response.text(), "");
    assert.ok(
      Date.parse(response.headers.get("X-Pulse-Server-Time")) >
        Date.parse("2026-01-01"),
    );
  } finally {
    if (original) globalThis.caches = original;
    else delete globalThis.caches;
  }
});
