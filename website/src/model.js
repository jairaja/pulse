export const languages = [
  ["en", "English"],
  ["zh-Hans", "中文"],
  ["hi", "हिन्दी"],
  ["es", "Español"],
  ["ar", "العربية"],
  ["fr", "Français"],
  ["bn", "বাংলা"],
  ["pt", "Português"],
  ["ru", "Русский"],
  ["ur", "اردو"],
];
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const number = (value) => new Intl.NumberFormat("en").format(value);
export const utcDate = (value) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export const utcTime = (value) =>
  `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(new Date(value))} UTC`;
export function percentages(item) {
  if (!item.total_votes) return { yes: 0, no: 0 };
  const yes = Math.round((item.yes_count / item.total_votes) * 1000) / 10;
  return { yes, no: Math.round((100 - yes) * 10) / 10 };
}
export function countdown(closesAt, now = Date.now()) {
  const minutes = Math.max(0, Math.ceil((Date.parse(closesAt) - now) / 60000));
  return minutes
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : "Refreshing…";
}
export function questionUrl(item, kind = "question", origin = location.origin) {
  const url = new URL("/", origin);
  url.searchParams.set("question", item.id);
  url.searchParams.set("kind", kind);
  return url.href;
}
