import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { HEADLINE, SUPPORTING } from "../lib/home/copy";
import { patientHref, tryCaseHref } from "../lib/home/cta";
import { DOCS_URL, LICENSE_URL, REPO_URL, STUDY_URL } from "../lib/home/links";

test("the brief's two fixed strings are exact", () => {
  assert.equal(HEADLINE, "The second pair of eyes in clinical reasoning.");
  assert.equal(
    SUPPORTING,
    "An open-source clinical intelligence platform helping patients understand their health concerns, clinicians explore diagnostic possibilities and hospitals strengthen diagnostic safety."
  );
});

test("external destinations are the intended https URLs", () => {
  assert.equal(REPO_URL, "https://github.com/Olarilewa/Diagnowise");
  assert.equal(LICENSE_URL, "https://github.com/Olarilewa/Diagnowise/blob/main/LICENSE");
  assert.equal(DOCS_URL, "https://github.com/Olarilewa/Diagnowise/tree/main/docs");
  assert.equal(STUDY_URL, "https://qualitysafety.bmj.com/content/23/9/727");
  for (const u of [REPO_URL, LICENSE_URL, DOCS_URL, STUDY_URL]) assert.ok(u.startsWith("https://"));
});

test("'Try a case' goes to a route that works for each kind of visitor", () => {
  assert.equal(tryCaseHref(null), "/sign-up/clinician");
  assert.equal(tryCaseHref("clinician"), "/cases/new");
  assert.equal(tryCaseHref("medical_student"), "/cases/new");
  assert.equal(tryCaseHref("hospital_admin"), "/hospital");
  assert.equal(tryCaseHref("patient"), "/patient");
  assert.equal(tryCaseHref("researcher"), "/dashboard");
  assert.equal(tryCaseHref("something-unknown"), "/sign-up/clinician");
});

test("the patient call to action never points at a closed door", () => {
  assert.equal(patientHref(null, false), null, "closed: no link at all");
  assert.equal(patientHref(null, true), "/sign-up/patient");
  assert.equal(patientHref("patient", false), "/patient", "an existing patient can always reach their area");
  assert.equal(patientHref("clinician", false), null);
});

// A cheap guard for the brief's "do not fabricate" rule: the homepage source must not make claims the project cannot back.
test("homepage copy makes no unsupported claims", () => {
  const dir = path.resolve(process.cwd(), "components/home");
  const files = [path.resolve(process.cwd(), "app/page.tsx"), ...readdirSync(dir).map((f) => path.resolve(dir, f))];
  const banned: [RegExp, string][] = [
    [/clinically validated|clinical(ly)? proven|proven to/i, "validation or proof claim"],
    [/\b(reduces?|reduced|reducing|eliminates?|prevents?) (diagnostic )?(errors?|misdiagnos\w+|harm)\b/i, "outcome claim"],
    [/\b\d{2,3}\s?%\s?(accura\w+|sensitiv\w+|specific\w+)|accuracy of\b/i, "accuracy figure"],
    [/trusted by|used by (hundreds|thousands|\d+)|partner(ed|s)? with|testimonial/i, "endorsement or usage claim"],
    [/\b\d[\d,]*\+?\s+(hospitals|clinics|clinicians|patients|users)\b/i, "user numbers"],
    [/\bHIPAA[- ]compliant|FDA[- ]approved|CE[- ]marked|certified\b/i, "compliance or approval claim"],
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of banned) assert.ok(!pattern.test(text), `${path.basename(file)}: ${label} (${pattern})`);
  }
});

test("exactly one statistic is shown, and it is labelled as a U.S. outpatient estimate", () => {
  const stat = readFileSync(path.resolve(process.cwd(), "components/home/safety-stat.tsx"), "utf8");
  assert.match(stat, /1 in 20/);
  assert.match(stat, /U\.S\. adults/);
  assert.match(stat, /outpatient/);
  assert.match(stat, /An estimate/);
  assert.match(stat, /partly funded by the Agency for Healthcare Research and Quality/);
  assert.ok(!/\b\d+(\.\d+)?%/.test(stat), "no second percentage statistic");
});
