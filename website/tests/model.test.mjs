import test from "node:test";
import assert from "node:assert/strict";
import {
  percentages,
  countdown,
  escape,
  questionUrl,
  utcDate,
} from "../src/model.js";
test("zero votes are not represented as a no majority; rounded shares sum to 100", () => {
  assert.deepEqual(percentages({ total_votes: 0 }), { yes: 0, no: 0 });
  assert.deepEqual(percentages({ total_votes: 3, yes_count: 1 }), {
    yes: 33.3,
    no: 66.7,
  });
});
test("public text cannot inject HTML and shared URLs contain no answer or account", () => {
  assert.equal(escape('<script>"&'), "&lt;script&gt;&quot;&amp;");
  const url = new URL(
    questionUrl(
      { id: "public-id", choice: "YES", email: "private" },
      "submission",
      "https://pulse.example",
    ),
  );
  assert.deepEqual([...url.searchParams.keys()], ["question", "kind"]);
});
test("countdown is UTC-boundary based and closed questions never get a negative time", () => {
  assert.equal(
    countdown("2026-11-07T00:00:00Z", Date.parse("2026-11-06T22:30:00Z")),
    "1h 30m",
  );
  assert.equal(
    countdown("2026-11-07T00:00:00Z", Date.parse("2026-11-07T00:00:01Z")),
    "Refreshing…",
  );
  assert.match(utcDate("2026-11-07T00:00:00Z"), /7 Nov 2026/);
});
