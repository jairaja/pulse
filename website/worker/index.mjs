const LANGUAGES = new Set([
  "en",
  "zh-Hans",
  "hi",
  "es",
  "ar",
  "fr",
  "bn",
  "pt",
  "ru",
  "ur",
]);
const SORTS = new Set(["most_upvoted", "newest", "oldest"]);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = () => {
  throw new HttpError(400, "Invalid filters. Please check your selection.");
};
const json = (value, status = 200, ttl = 0) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      ...SECURITY,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": ttl ? `public, max-age=${ttl}` : "no-store",
    },
  });
const date = (value) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail();
  return value;
};
const nextDay = (value) =>
  new Date(Date.parse(value) + 86400000).toISOString().slice(0, 10);
const text = (value) => {
  if (typeof value !== "string" || !value || value.length > 10000)
    throw new Error("Invalid upstream text");
  return value;
};
const count = (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || value === null)
    throw new Error("Invalid upstream count");
  return n;
};
const uuid = (value) => {
  if (!UUID.test(value ?? "")) throw new Error("Invalid upstream id");
  return value;
};
const stamp = (value) => {
  text(value);
  if (!Number.isFinite(Date.parse(value)))
    throw new Error("Invalid upstream time");
  return value;
};
const question = (row) => ({
  id: uuid(row.id ?? row.question_id),
  question_text: text(row.question_text),
  asked_on: date(row.asked_on),
  source_language: text(row.source_language),
  sponsored: row.sponsored === true,
});
const result = (row) => {
  const yes = count(row.yes_count),
    no = count(row.no_count),
    total = count(row.total_votes);
  if (
    yes + no !== total ||
    !["YES", "NO", "TIE"].includes(row.result) ||
    row.result !== (yes === no ? "TIE" : yes > no ? "YES" : "NO")
  )
    throw new Error("Invalid upstream result");
  return {
    ...question(row),
    yes_count: yes,
    no_count: no,
    total_votes: total,
    result: row.result,
    finalized_at: stamp(row.finalized_at),
  };
};
const brewing = (row) => ({
  id: uuid(row.id),
  question_text: text(row.question_text ?? row.text),
  created_at: stamp(row.created_at),
  upvote_count: count(row.upvote_count),
});
const encode = (value) =>
  btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const decode = (value) => {
  try {
    if (value.length > 2048 || !/^[\w-]+$/.test(value)) fail();
    const row = JSON.parse(
      atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      row.scope !== "guest"
    )
      fail();
    return row;
  } catch {
    fail();
  }
};
function publicStore(value, host) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      u.hostname === host &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function publicConfig(env) {
  return {
    playStoreUrl: publicStore(env.PLAY_STORE_URL, "play.google.com"),
    appStoreUrl: publicStore(env.APP_STORE_URL, "apps.apple.com"),
    contactEmail: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
      env.CONTACT_EMAIL ?? "",
    )
      ? env.CONTACT_EMAIL
      : null,
  };
}
async function rpc(env, name, body, fetcher) {
  const project = new URL(env.SUPABASE_URL);
  if (
    project.protocol !== "https:" ||
    project.username ||
    project.password ||
    project.pathname !== "/" ||
    project.search ||
    project.hash ||
    !env.SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")
  )
    throw new Error("Public API not configured");
  const response = await fetcher(`${project.origin}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    if (name === "browse_brewing_questions" && response.status === 400)
      throw new HttpError(
        409,
        "This question list has changed. Refresh to continue.",
      );
    throw new Error("Public API unavailable");
  }
  return response.json();
}
// Explicit routes only: this is never a generic RPC proxy and never accepts a user session.
export async function api(request, env, fetcher = fetch, clock = Date.now) {
  const readClock = typeof clock === "function" ? clock : () => clock;
  const startedAt = readClock();
  if (!["GET", "HEAD"].includes(request.method))
    return json({ error: "This website is read-only." }, 405);
  const url = new URL(request.url),
    p = url.searchParams;
  const language = p.get("language") ?? "en";
  try {
    if (!LANGUAGES.has(language)) fail();
    let data;
    if (url.pathname === "/api/config") data = publicConfig(env);
    else if (url.pathname === "/api/today") {
      const rows = await rpc(
        env,
        "get_today_question",
        { p_language_code: language },
        fetcher,
      );
      if (!Array.isArray(rows) || rows.length > 1)
        throw new Error("Invalid upstream list");
      data = rows.length
        ? {
            ...question(rows[0]),
            server_time: stamp(rows[0].server_time),
            voting_closes_at: stamp(rows[0].voting_closes_at),
          }
        : null;
    } else if (url.pathname === "/api/brewing") {
      const sort = p.get("sort") ?? "most_upvoted",
        filter = p.get("filter") ?? "all";
      if (!SORTS.has(sort) || !["all", "today"].includes(filter)) fail();
      const rows = await rpc(
        env,
        "browse_brewing_questions",
        {
          p_sort: sort,
          p_filter: filter,
          p_limit: 20,
          p_cursor: p.has("cursor") ? decode(p.get("cursor")) : null,
        },
        fetcher,
      );
      if (!Array.isArray(rows.items) || rows.items.length > 20)
        throw new Error("Invalid upstream list");
      data = {
        items: rows.items.map(brewing),
        next_cursor: rows.next_cursor ? encode(rows.next_cursor) : null,
      };
    } else if (url.pathname === "/api/results") {
      const from = p.has("from") ? date(p.get("from")) : null,
        to = p.has("to") ? date(p.get("to")) : null;
      const outcome = p.get("outcome") ?? "all",
        minimum = p.get("minimum") ?? "0",
        query = (p.get("q") ?? "").trim().toLocaleLowerCase();
      if (
        (from && to && from > to) ||
        !["all", "YES", "NO", "TIE"].includes(outcome) ||
        !["0", "100", "1000"].includes(minimum) ||
        query.length > 100
      )
        fail();
      let before = p.has("cursor")
        ? date(p.get("cursor"))
        : to
          ? nextDay(to)
          : null;
      if (to && before > nextDay(to)) fail();
      const items = [];
      let next = null;
      // Bounded scan: filters apply to the archive, not just visible cards. Continue with a cursor.
      for (let page = 0; page < 3; page++) {
        const rows = await rpc(
          env,
          "list_finalized_results",
          { p_language_code: language, p_limit: 20, p_before: before },
          fetcher,
        );
        if (!Array.isArray(rows) || rows.length > 20)
          throw new Error("Invalid upstream list");
        next = null;
        for (let index = 0; index < rows.length; index++) {
          const item = result(rows[index]);
          if (from && item.asked_on < from) {
            before = null;
            next = null;
            break;
          }
          before = item.asked_on;
          if (
            (!to || item.asked_on <= to) &&
            (outcome === "all" || outcome === item.result) &&
            item.total_votes >= Number(minimum) &&
            item.question_text.toLocaleLowerCase().includes(query)
          )
            items.push(item);
          next = index < rows.length - 1 || rows.length === 20 ? before : null;
          if (items.length === 20) break;
        }
        if (items.length === 20 || !next || !before) break;
      }
      data = { items, next_cursor: next };
    } else if (url.pathname === "/api/question") {
      const id = p.get("id"),
        kind = p.get("kind") ?? "question";
      if (!UUID.test(id ?? "") || !["question", "submission"].includes(kind))
        fail();
      const row = await rpc(
        env,
        "resolve_public_question",
        { p_id: id, p_kind: kind },
        fetcher,
      );
      if (!row) data = null;
      else if (row.destination === "brewing")
        data = { ...brewing(row), destination: "brewing" };
      else if (["today", "past-results"].includes(row.destination)) {
        const q = {
          ...row,
          question_text: row.text,
          source_language: row.source_language ?? "original",
        };
        data =
          row.destination === "past-results"
            ? { ...result(q), destination: row.destination }
            : {
                id: uuid(row.id),
                question_text: text(row.text),
                asked_on: date(row.asked_on),
                destination: "today",
              };
      } else throw new Error("Invalid upstream destination");
    } else if (url.pathname === "/api/search") {
      const query = (p.get("q") ?? "").trim();
      if (query.length < 2 || query.length > 100) fail();
      const rows = await rpc(
        env,
        "search_public_questions",
        { p_query: query, p_limit: 6 },
        fetcher,
      );
      if (!Array.isArray(rows) || rows.length > 6)
        throw new Error("Invalid upstream list");
      data = rows.map((row) => {
        if (!["brewing", "today", "past-results"].includes(row.destination))
          throw new Error("Invalid destination");
        return {
          id: uuid(row.id),
          question_text: text(row.question_text),
          destination: row.destination,
        };
      });
    } else return json({ error: "Page not found." }, 404);
    // Never retain yesterday's data over the UTC boundary. No stale-while-revalidate.
    const completedAt = readClock();
    const crossedBoundary =
      Math.floor(startedAt / 86400000) !== Math.floor(completedAt / 86400000);
    const ttl = crossedBoundary
      ? 0
      : Math.max(
          0,
          Math.min(
            20,
            Math.floor((86400000 - (completedAt % 86400000)) / 1000) - 1,
          ),
        );
    return json(
      { data, fetched_at: new Date(completedAt).toISOString() },
      200,
      ttl,
    );
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    return json(
      { error: "Questions could not be loaded. Please try again shortly." },
      503,
    );
  }
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // Public, canonical URL cache only. Incoming Authorization/cookies are neither used nor forwarded.
      const key = new Request(url.href, { method: "GET" });
      const cache = globalThis.caches?.default;
      if (["GET", "HEAD"].includes(request.method) && cache) {
        const hit = await cache.match(key);
        if (hit) return stampResponse(hit, request.method === "HEAD");
      }
      const response = await api(request, env);
      if (
        response.ok &&
        request.method === "GET" &&
        cache &&
        /^public, max-age=[1-9]/.test(response.headers.get("Cache-Control"))
      )
        ctx.waitUntil(cache.put(key, response.clone()));
      return stampResponse(response, request.method === "HEAD");
    }
    if (!["GET", "HEAD"].includes(request.method))
      return json({ error: "Method not allowed." }, 405);
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    for (const [key, value] of Object.entries(SECURITY))
      headers.set(key, value);
    return new Response(asset.body, { status: asset.status, headers });
  },
};
function stampResponse(response, head) {
  const headers = new Headers(response.headers);
  // A fresh edge clock avoids treating a cached RPC's server_time as the current time.
  headers.set("X-Pulse-Server-Time", new Date().toISOString());
  return new Response(head ? null : response.body, {
    status: response.status,
    headers,
  });
}
