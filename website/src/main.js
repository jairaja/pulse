import "./style.css";
import {
  escape as e,
  languages,
  number,
  utcDate,
  utcTime,
  percentages,
  countdown,
  questionUrl,
} from "./model.js";

const app = document.querySelector("#app");
const icons = {
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  share:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
};
const defaults = {
  language: "en",
  view: "list",
  theme: "system",
  largerText: false,
};
let preferences;
try {
  preferences = {
    ...defaults,
    ...JSON.parse(localStorage.getItem("pulse-website-preferences") ?? "{}"),
  };
} catch {
  preferences = { ...defaults };
}
if (!languages.some(([code]) => code === preferences.language))
  preferences.language = "en";
let config = {},
  active = "today",
  generation = 0,
  controller,
  currentData = [],
  nextCursor = null,
  loadingMore = false,
  serverOffset = 0;
let lastDay = new Date().toISOString().slice(0, 10),
  loadStarted = 0;
const records = new Map();
const filters = {
  brewing: { sort: "most_upvoted", filter: "all" },
  results: { from: "", to: "", outcome: "all", minimum: "0", q: "" },
};
function save() {
  try {
    localStorage.setItem(
      "pulse-website-preferences",
      JSON.stringify(preferences),
    );
  } catch {
    /* Browsing works without storage. */
  }
  applyPreferences();
}
function applyPreferences() {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.classList.toggle(
    "larger-text",
    preferences.largerText === true,
  );
}
applyPreferences();
function storeLinks() {
  return (
    [
      config.appStoreUrl &&
        `<a class="store-link" href="${e(config.appStoreUrl)}" target="_blank" rel="noopener noreferrer">App Store ${icons.arrow}</a>`,
      config.playStoreUrl &&
        `<a class="store-link" href="${e(config.playStoreUrl)}" target="_blank" rel="noopener noreferrer">Google Play ${icons.arrow}</a>`,
    ]
      .filter(Boolean)
      .join("") ||
    '<p class="muted">Store links will appear here when Pulse launches.</p>'
  );
}
function shell() {
  app.innerHTML = `
    <header class="site-header"><div class="header-inner">
      <a class="brand" href="/" aria-label="Pulse home"><img src="/favicon.svg" alt="" width="32" height="32">pulse<span class="brand-dot">.</span></a>
      <nav aria-label="Main navigation"><a href="?tab=today" data-tab="today">Today</a><a href="?tab=brewing" data-tab="brewing">Brewing</a><a href="?tab=results" data-tab="results">Past results</a><a href="?tab=about" data-tab="about">About</a></nav>
      <a class="header-download" href="#get-app">Get the app ${icons.arrow}</a>
    </div></header>
    <main id="main" tabindex="-1">
      <div class="utility-bar"><span class="eyebrow"><span class="status-dot"></span> A little curiosity. A wider perspective.</span><button class="text-button" id="open-settings" aria-label="Open display and question language settings">Display & language</button></div>
      <div id="page"></div>
      <section class="search-section" aria-labelledby="search-title"><div><span class="eyebrow">Follow your curiosity</span><h2 id="search-title">Looking for a question?</h2><p class="muted">Search public questions across Today, Brewing and Past results.</p></div><form id="search-form" role="search"><label class="sr-only" for="global-search">Search public questions</label><div class="search-box"><input id="global-search" name="q" type="search" minlength="2" maxlength="100" placeholder="Try “public transport”" required><button type="submit" class="icon-button" aria-label="Search">${icons.search}</button></div><div id="search-results" aria-live="polite"></div></form></section>
      <section class="download-section" id="get-app"><div><span class="eyebrow">A daily moment of perspective</span><h2>Have your say.<br>Find your Pulse.</h2><p>Vote on the daily question. Ask what matters to you.<br>Help the community choose what comes next.</p></div><div class="download-actions">${storeLinks()}<span class="small">Explore here. Participate in the app.</span></div></section>
    </main>
    <footer><a class="brand" href="/">pulse.</a><p>One question. Many perspectives.</p><div><a href="?tab=about" data-tab="about">About & privacy</a>${config.contactEmail ? `<a href="mailto:${e(config.contactEmail)}">Contact</a>` : ""}<span>© ${new Date().getUTCFullYear()} Pulse</span></div></footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <dialog id="settings-dialog" aria-labelledby="settings-title"><button class="close-dialog" data-close="settings-dialog" aria-label="Close settings">×</button><h2 id="settings-title">Make yourself comfortable.</h2><label for="theme-select">Appearance</label><select id="theme-select"><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select><label for="language-select">Question language</label><select id="language-select">${languages.map(([code, name]) => `<option value="${code}">${name}</option>`).join("")}</select><p class="small muted">Today and past questions use published translations where available, otherwise their original text. Brewing and search show original text. Website navigation is currently in English.</p><label class="checkbox"><input type="checkbox" id="larger-text"> Larger text</label><p class="small muted">Saved only in this browser. This website has no login or account preferences.</p></dialog>
    <dialog id="report-dialog" aria-labelledby="report-title"><button class="close-dialog" data-close="report-dialog" aria-label="Close report">×</button><h2 id="report-title">Your results report</h2><p class="muted">Download a PDF, or print this text report and choose “Save as PDF”.</p><div class="report-actions"><button class="button primary" id="download-report">${icons.download} Download PDF</button><button class="button" id="print-report">Print / save PDF</button></div><div id="report-content"></div></dialog>`;
  document.querySelector("#theme-select").value = preferences.theme;
  document.querySelector("#language-select").value = preferences.language;
  document.querySelector("#larger-text").checked = preferences.largerText;
}
async function api(path, params = {}, signal) {
  const url = new URL(`/api/${path}`, location.origin);
  for (const [key, value] of Object.entries(params))
    if (value !== "" && value !== null && value !== undefined)
      url.searchParams.set(key, value);
  const response = await fetch(url, { signal, cache: "no-store" });
  const edgeTime = Date.parse(response.headers.get("X-Pulse-Server-Time"));
  if (Number.isFinite(edgeTime)) serverOffset = edgeTime - Date.now();
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The website connection is unavailable. Please try again.");
  }
  if (!response.ok)
    throw new Error(body.error ?? "Questions could not be loaded.");
  return body;
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 4500);
}
function pageHeading(kicker, title, description) {
  return `<div class="page-heading"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>`;
}
function pending() {
  return '<div class="loading" role="status"><span class="spinner"></span> Finding your next perspective…</div>';
}
function empty(title, text) {
  return `<div class="empty-state"><span class="empty-mark" aria-hidden="true">○</span><h3>${e(title)}</h3><p>${e(text)}</p></div>`;
}
function remember(item, kind = "question") {
  records.set(`${kind}:${item.id}`, item);
  return `${kind}:${item.id}`;
}
function actions(item, kind, pdf = false) {
  const key = remember(item, kind);
  return `<div class="card-actions"><button class="text-button" data-share="${key}" aria-label="Share question: ${e(item.question_text)}">${icons.share} Share</button>${pdf ? `<button class="text-button" data-report="${key}" aria-label="View or download PDF results for: ${e(item.question_text)}">${icons.download} PDF report</button>` : ""}</div>`;
}
function resultCard(item) {
  const p = percentages(item),
    outcome = item.total_votes
      ? item.result === "TIE"
        ? "Evenly divided"
        : `${item.result} majority`
      : "No votes cast";
  return `<article class="result-card" data-question="${item.id}"><div class="card-meta"><time datetime="${e(item.asked_on)}">${utcDate(item.asked_on)}</time><span class="outcome">${outcome}</span></div><h3 dir="auto"><a href="${e(questionUrl(item))}" data-question-link>${e(item.question_text)}</a></h3><div class="result-labels"><span>Yes <strong>${p.yes}%</strong></span><span>No <strong>${p.no}%</strong></span></div><div class="result-bar" role="img" aria-label="Yes ${number(item.yes_count)} votes (${p.yes} percent), No ${number(item.no_count)} votes (${p.no} percent)"><span style="width:${item.total_votes ? p.yes : 0}%"></span></div><div class="count-line"><span>${number(item.total_votes)} votes</span><span>YES ${number(item.yes_count)} · NO ${number(item.no_count)}</span></div>${actions(item, "question", true)}</article>`;
}
function brewingCard(item, index) {
  return `<article class="brewing-card" data-question="${item.id}"><div class="question-rank" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div><div class="brewing-body"><div class="card-meta"><span>Community question</span><time datetime="${e(item.created_at)}">${utcTime(item.created_at)}</time></div><h3 dir="auto"><a href="${e(questionUrl(item, "submission"))}" data-question-link>${e(item.question_text)}</a></h3>${actions(item, "submission")}</div><div class="support-count"><span aria-hidden="true">↑</span><strong>${number(item.upvote_count)}</strong><span>upvotes</span></div></article>`;
}
function filterControls() {
  if (active === "brewing")
    return `<div class="filter-controls"><label>Sort by<select name="sort"><option value="most_upvoted">Most supported</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label><label>Submitted<select name="filter"><option value="all">Any time</option><option value="today">Today (UTC)</option></select></label></div>`;
  return `<div class="filter-controls"><label>From (UTC)<input type="date" name="from"></label><label>To (UTC)<input type="date" name="to"></label><label>Result<select name="outcome"><option value="all">All results</option><option value="YES">Yes majority</option><option value="NO">No majority</option><option value="TIE">Tied</option></select></label><label>Participation<select name="minimum"><option value="0">Any total</option><option value="100">100+ votes</option><option value="1000">1,000+ votes</option></select></label><label class="keyword-label">Question contains<input name="q" type="search" maxlength="100" placeholder="A word or phrase"></label></div>`;
}
function archiveShell() {
  const brew = active === "brewing";
  return `${pageHeading(brew ? "The next conversation starts here" : "A little perspective, preserved", brew ? "What’s brewing?" : "Every question leaves a story.", brew ? "Discover the questions on people’s minds. Browse by support or submission time, then join the conversation in the app." : "Explore finalized daily results, follow your curiosity, and take a report with you.")}<aside class="info-strip">${brew ? "At 00:00 UTC, the eligible question with the most cumulative upvotes becomes the daily question. A later submission wins a tie." : "Results appear at 00:00 UTC after voting closes. Exact totals reflect participating Pulse users."}</aside><form id="filters">${filterControls()}<div class="filter-actions"><button class="button primary" type="submit">Apply filters ${icons.arrow}</button><button class="text-button" type="button" id="reset-filters">Reset</button></div></form><div class="section-toolbar"><span id="result-summary" role="status"></span><div><button class="text-button" id="refresh">Refresh</button>${brew ? "" : `<button class="text-button" id="batch-report">${icons.download} Report of loaded results</button>`}<button class="icon-button" id="view-toggle" aria-label="Switch to ${preferences.view === "grid" ? "list" : "grid"} view">${icons.grid}</button></div></div><div id="cards" class="cards ${preferences.view === "grid" ? "grid" : ""}">${pending()}</div><div id="pagination" class="pagination"></div><p class="small muted footnote">${brew ? "“Most supported” uses all-time upvotes on questions still in Brewing, not a recent-activity trend. Lists refresh at midnight UTC." : "Newest first. Filters search up to 60 archive entries per request; continue browsing if more entries remain. Reports contain only the results you have loaded."}</p>`;
}
function syncFilterControls() {
  for (const [key, value] of Object.entries(filters[active] ?? {})) {
    const input = document.querySelector(`#filters [name="${key}"]`);
    if (input) input.value = value;
  }
}
function drawCards() {
  const brew = active === "brewing";
  document.querySelector("#cards").innerHTML = currentData.length
    ? currentData
        .map((item, index) =>
          brew ? brewingCard(item, index) : resultCard(item),
        )
        .join("")
    : empty(
        nextCursor ? "Keep exploring." : "A little quiet here.",
        nextCursor
          ? "No matches in this part of the archive. Continue browsing or broaden your filters."
          : brew
            ? "No published questions match these filters yet. Try another selection or check back soon."
            : "No finalized results match these filters. Try another date or selection.",
      );
  document.querySelector("#result-summary").textContent =
    `${number(currentData.length)} ${brew ? "questions" : "results"} loaded${nextCursor ? " · more to explore" : ""}`;
  document.querySelector("#pagination").innerHTML = nextCursor
    ? `<button class="button" id="load-more">${currentData.length >= 100 ? "Next page (replace loaded results)" : "Explore more"} ${icons.arrow}</button>`
    : "";
}
async function loadArchive(append = false) {
  if (loadingMore && append) return;
  const token = generation,
    cursor = append ? nextCursor : null;
  if (append) {
    loadingMore = true;
    const b = document.querySelector("#load-more");
    if (b) {
      b.disabled = true;
      b.textContent = "Loading…";
    }
  }
  try {
    const { data } = await api(
      active === "brewing" ? "brewing" : "results",
      { ...filters[active], language: preferences.language, cursor },
      controller.signal,
    );
    if (token !== generation) return;
    const old = append && currentData.length < 100 ? currentData : [];
    currentData = [
      ...new Map(
        [...old, ...data.items].map((item) => [item.id, item]),
      ).values(),
    ];
    nextCursor = data.next_cursor;
    drawCards();
  } catch (error) {
    if (error.name === "AbortError" || token !== generation) return;
    if (append) {
      toast(error.message);
      const b = document.querySelector("#load-more");
      if (b) {
        b.disabled = false;
        b.textContent = "Try loading more";
      }
    } else
      document.querySelector("#cards").innerHTML =
        `${empty("Let’s try that again.", error.message)}<button class="button retry" id="refresh">Retry</button>`;
  } finally {
    if (token === generation) loadingMore = false;
  }
}
async function today() {
  const token = generation;
  document.querySelector("#page").innerHTML =
    `${pageHeading("A daily moment of curiosity", "One question.<br><em>Many perspectives.</em>", "A shared question. A simple yes or no. Discover where perspectives meet—and where they take different paths.")}<div class="today-layout"><section id="today-card" class="today-card">${pending()}</section><aside class="rhythm-card"><span class="eyebrow">The daily rhythm</span><div class="rhythm-step"><span>01</span><div><h3>A question opens.</h3><p>Every day at 00:00 UTC.</p></div></div><div class="rhythm-step"><span>02</span><div><h3>You have your say.</h3><p>A yes or no in the Pulse app.</p></div></div><div class="rhythm-step"><span>03</span><div><h3>A wider view unfolds.</h3><p>Results arrive at the next 00:00 UTC, alongside a new question.</p></div></div><a href="?tab=about" data-tab="about" class="text-link">Get to know Pulse ${icons.arrow}</a></aside></div><section class="recent-section"><div class="section-header"><div><span class="eyebrow">In case you missed it</span><h2>Recent perspectives</h2></div><a href="?tab=results" data-tab="results" class="text-link">All past results ${icons.arrow}</a></div><div id="recent-results" class="recent-grid">${pending()}</div></section>`;
  const live = api(
    "today",
    { language: preferences.language },
    controller.signal,
  )
    .then(({ data }) => {
      if (token !== generation) return;
      const card = document.querySelector("#today-card");
      if (!data) {
        card.innerHTML = empty(
          "A new question is on its way.",
          "There is no live question right now. Explore Brewing and past results while you wait.",
        );
        return;
      }
      card.innerHTML = `<div class="card-meta"><span class="live-badge"><span class="status-dot"></span> Today’s question</span><time datetime="${e(data.asked_on)}">${utcDate(data.asked_on)}</time></div><h2 dir="auto">${e(data.question_text)}</h2><div class="yes-no" aria-hidden="true"><span>Yes ${icons.arrow}</span><span>No ${icons.arrow}</span></div><p class="small muted">A read-only window into Pulse. Cast your vote in the app.</p><div class="live-bottom"><div><span class="eyebrow">Results & next question in</span><strong id="countdown" data-closes="${e(data.voting_closes_at)}">${countdown(data.voting_closes_at, Date.now() + serverOffset)}</strong><span class="small">${utcDate(data.voting_closes_at)} · 00:00 UTC</span></div><a class="button primary" href="#get-app">Get the app ${icons.arrow}</a></div>${actions(data, "question")}`;
    })
    .catch((error) => {
      if (error.name !== "AbortError" && token === generation)
        document.querySelector("#today-card").innerHTML =
          `${empty("Today’s question couldn’t load.", error.message)}<button class="button" id="refresh">Try again</button>`;
    });
  const recent = api(
    "results",
    { language: preferences.language },
    controller.signal,
  )
    .then(({ data }) => {
      if (token === generation)
        document.querySelector("#recent-results").innerHTML = data.items.length
          ? data.items.slice(0, 3).map(resultCard).join("")
          : empty(
              "The story starts here.",
              "Finalized results will appear after a daily question closes.",
            );
    })
    .catch((error) => {
      if (error.name !== "AbortError" && token === generation)
        document.querySelector("#recent-results").innerHTML = empty(
          "Past results couldn’t load.",
          "You can try again from Past results.",
        );
    });
  await Promise.all([live, recent]);
}
function about() {
  return `${pageHeading("A space for shared curiosity", "A small question.<br>A bigger conversation.", "Pulse brings people together around one yes-or-no question each UTC day. No perfect answer required. Just your perspective.")}<div class="about-grid"><article><span class="eyebrow">How it works</span><h2>Asked by the community.<br>Chosen by the community.</h2><p>In the app, verified accounts can submit one question and support one other person’s question per UTC day. The eligible question with the most cumulative support becomes the next daily question. If support is tied, the later submission wins.</p><p>Questions are reviewed for safety before appearing publicly. Moderation does not let someone hand-pick the winning question.</p></article><article><span class="eyebrow">Explore freely</span><h2>Your curiosity needs no account.</h2><p>This website lets everyone read the current question, explore published Brewing questions, share links, and view or download finalized results.</p><p>Daily voting happens in the app, including guest voting. Asking and upvoting Brewing questions require sign-in there.</p></article><article><span class="eyebrow">Reading the results</span><h2>Participation, not a population estimate.</h2><p>We show exact YES and NO totals after voting closes. These reflect Pulse participants—not a statistically representative sample of the world. We do not infer country results from your location.</p><p>Live YES/NO totals stay hidden until finalization. No website account or personal voting history is available here.</p></article><article><span class="eyebrow">Privacy on this website</span><h2>A lighter footprint.</h2><p>This site sets no login cookies and includes no advertising, analytics tracker or social-media embed. Display preferences are saved in this browser only. Cloudflare and Supabase process network requests to deliver the website and public data; their operational logging and your deployment settings still apply.</p><p>The mobile app has its own account and device-protection flows. This website does not handle app authentication recovery or verified mobile links.</p></article></div>`;
}
async function openQuestion(params) {
  const token = generation,
    id = params.get("question"),
    kind = params.get("kind") ?? "question";
  try {
    const { data } = await api("question", { id, kind }, controller.signal);
    if (token !== generation) return;
    if (!data) {
      document
        .querySelector("#page")
        .insertAdjacentHTML(
          "afterbegin",
          empty(
            "This question is unavailable.",
            "It may have been removed or may not be public.",
          ),
        );
      return;
    }
    const selected = `<section class="selected-question" aria-label="Shared question"><div class="section-header"><span class="eyebrow">You followed a shared question</span><button class="text-button" id="clear-question">Close</button></div>${data.destination === "past-results" ? resultCard(data) : data.destination === "brewing" ? brewingCard(data, 0) : `<h2 dir="auto">${e(data.question_text)}</h2><p>Daily question · ${utcDate(data.asked_on)}. Results become available after its UTC voting day closes.</p>${actions(data, "question")}`}</section>`;
    document.querySelector("#page").insertAdjacentHTML("afterbegin", selected);
  } catch (error) {
    if (error.name !== "AbortError" && token === generation)
      toast(error.message);
  }
}
async function route() {
  generation++;
  controller?.abort();
  controller = new AbortController();
  loadingMore = false;
  records.clear();
  const routeToken = generation;
  const params = new URLSearchParams(location.search),
    tab = params.get("tab") ?? "today";
  active = ["today", "brewing", "results", "about"].includes(tab)
    ? tab
    : "today";
  currentData = [];
  nextCursor = null;
  loadStarted = Date.now();
  document.querySelectorAll("[data-tab]").forEach((link) => {
    if (link.dataset.tab === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `Pulse — ${{ today: "One question. Many perspectives.", brewing: "Brewing questions", results: "Past results", about: "About" }[active]}`;
  if (active === "today") await today();
  else if (active === "about")
    document.querySelector("#page").innerHTML = about();
  else {
    document.querySelector("#page").innerHTML = archiveShell();
    syncFilterControls();
    await loadArchive();
  }
  if (routeToken === generation && params.has("question"))
    await openQuestion(params);
}
function navigate(href) {
  const url = new URL(href, location.origin);
  history.pushState({}, "", url);
  route();
  document.querySelector("#main").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
async function share(key) {
  const item = records.get(key);
  if (!item) return;
  const url = questionUrl(
    item,
    key.startsWith("submission:") ? "submission" : "question",
  );
  try {
    if (navigator.share)
      await navigator.share({
        title: "Pulse — A question worth exploring",
        text: item.question_text,
        url,
      });
    else {
      await navigator.clipboard.writeText(url);
      toast("Question link copied.");
    }
  } catch (error) {
    if (error.name !== "AbortError")
      toast(
        "Sharing is unavailable here. Open the question and copy its address from your browser.",
      );
  }
}
let reportItems = [];
function report(items) {
  if (!items.length) {
    toast("Load some finalized results first.");
    return;
  }
  reportItems = items.slice(0, 100);
  document.querySelector("#report-content").innerHTML =
    `<p class="small">${reportItems.length} finalized result${reportItems.length === 1 ? "" : "s"} · Prepared ${utcTime(new Date().toISOString())}</p>${reportItems.map(resultCard).join("")}<p class="small">Participating Pulse users are not a representative global sample. Voting runs from 00:00 UTC to the next 00:00 UTC. Each card links to its public question.</p>`;
  document.querySelector("#report-dialog").showModal();
}
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-tab],a[data-question-link]");
  if (
    link &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    event.button === 0
  ) {
    event.preventDefault();
    navigate(link.href);
    return;
  }
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.close) {
    document.getElementById(button.dataset.close).close();
    return;
  }
  if (button.dataset.share) {
    share(button.dataset.share);
    return;
  }
  if (button.dataset.report) {
    const item = records.get(button.dataset.report);
    if (item) report([item]);
    return;
  }
  if (button.id === "open-settings")
    document.querySelector("#settings-dialog").showModal();
  if (button.id === "refresh") route();
  if (button.id === "load-more") loadArchive(true);
  if (button.id === "view-toggle") {
    preferences.view = preferences.view === "grid" ? "list" : "grid";
    save();
    document
      .querySelector("#cards")
      .classList.toggle("grid", preferences.view === "grid");
    button.setAttribute(
      "aria-label",
      `Switch to ${preferences.view === "grid" ? "list" : "grid"} view`,
    );
  }
  if (button.id === "reset-filters") {
    filters[active] =
      active === "brewing"
        ? { sort: "most_upvoted", filter: "all" }
        : { from: "", to: "", outcome: "all", minimum: "0", q: "" };
    route();
  }
  if (button.id === "clear-question") {
    const url = new URL(location);
    url.searchParams.delete("question");
    url.searchParams.delete("kind");
    navigate(url);
  }
  if (button.id === "batch-report") report(currentData);
  if (button.id === "print-report") window.print();
  if (button.id === "download-report") {
    button.disabled = true;
    button.textContent = "Preparing PDF…";
    const snapshot = [...reportItems];
    import("./pdf.js")
      .then(({ downloadReport }) => downloadReport(snapshot))
      .catch((error) =>
        toast(
          error.message ||
            "PDF could not be generated. Please use Print / save PDF.",
        ),
      )
      .finally(() => {
        button.disabled = false;
        button.innerHTML = `${icons.download} Download PDF`;
      });
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "theme-select") {
    preferences.theme = event.target.value;
    save();
  }
  if (event.target.id === "larger-text") {
    preferences.largerText = event.target.checked;
    save();
  }
  if (event.target.id === "language-select") {
    preferences.language = event.target.value;
    save();
    route();
  }
});
let searchGeneration = 0,
  searchController;
document.addEventListener("submit", async (event) => {
  if (event.target.id === "filters") {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (values.from && values.to && values.from > values.to) {
      toast("Choose an end date on or after the start date.");
      return;
    }
    filters[active] = values;
    route();
  }
  if (event.target.id === "search-form") {
    event.preventDefault();
    const query = document.querySelector("#global-search").value.trim();
    if (query.length < 2) return;
    const token = ++searchGeneration;
    searchController?.abort();
    searchController = new AbortController();
    const box = document.querySelector("#search-results");
    box.innerHTML = pending();
    try {
      const { data } = await api(
        "search",
        { q: query },
        searchController.signal,
      );
      if (token !== searchGeneration) return;
      box.innerHTML = data.length
        ? `<ul class="search-hits">${data.map((item) => `<li><a href="${e(questionUrl(item, item.destination === "brewing" ? "submission" : "question"))}" data-question-link><span dir="auto">${e(item.question_text)}</span><small>${e({ brewing: "Brewing", today: "Today", "past-results": "Past results" }[item.destination])} ↗</small></a></li>`).join("")}</ul><p class="small muted">Up to six closest matches in the original question text.</p>`
        : "<p>No public questions matched. Try another phrase.</p>";
    } catch (error) {
      if (error.name !== "AbortError" && token === searchGeneration)
        box.textContent = error.message;
    }
  }
});
window.addEventListener("popstate", route);
function refreshIfNeeded() {
  const day = new Date(Date.now() + serverOffset).toISOString().slice(0, 10);
  if (day !== lastDay) {
    lastDay = day;
    route();
  } else if (Date.now() - loadStarted > 5 * 60000 && !document.hidden) route();
  const el = document.querySelector("#countdown");
  if (el)
    el.textContent = countdown(el.dataset.closes, Date.now() + serverOffset);
}
setInterval(() => {
  if (!document.hidden) refreshIfNeeded();
}, 15000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshIfNeeded();
});
window.addEventListener("online", () => route());
shell();
route();
api("config")
  .then(({ data }) => {
    config = data;
    document.querySelector(".download-actions").innerHTML =
      `${storeLinks()}<span class="small">Explore here. Participate in the app.</span>`;
    if (config.contactEmail)
      document
        .querySelector("footer>div")
        .insertAdjacentHTML(
          "afterbegin",
          `<a href="mailto:${e(config.contactEmail)}">Contact</a>`,
        );
  })
  .catch(() => {
    /* Static site and public browsing remain available. */
  });
