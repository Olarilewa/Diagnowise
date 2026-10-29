import { test } from "node:test";
import assert from "node:assert/strict";
import { screenPatientText } from "../src/patient-safety/emergency-screen.js";
import { buildPatientGuidance, sanitizePatientFacingText, type PatientGuidance, type PatientGuidanceInput, type Urgency } from "../src/patient-safety/guidance.js";
import { checkOvercertainLanguage } from "../src/safety/guardrails.js";

const RANK: Record<Urgency, number> = { routine: 0, soon: 1, urgent: 2, emergency: 3 };
const analysis = (over: Partial<PatientGuidanceInput> = {}): PatientGuidanceInput => ({ redFlags: [], differential: [], missingInformation: [], ...over });
const allText = (g: PatientGuidance) => [g.headline, ...g.actions, ...g.featuresToMention, ...g.questionsForYourClinician, g.disclaimer].join(" \n ");

// ---------------- emergency screen ----------------
test("screen: recognises emergencies, including curly apostrophes and casing", () => {
  const cases: [string, string][] = [
    ["I have crushing chest pain", "medical"], ["I CAN’T BREATHE", "medical"], ["can't breathe properly", "medical"],
    ["she is vomiting blood", "medical"], ["he is unresponsive", "medical"], ["my face is drooping and speech is slurred speech", "medical"],
    ["worst headache of my life", "medical"], ["my throat is swelling", "medical"], ["I think I took an overdose", "medical"],
    ["I want to die", "crisis"], ["thinking about suicide", "crisis"], ["I keep wanting to hurt myself", "crisis"],
    ["I've been coughing up blood", "urgent"], ["there is blood in my stool", "urgent"], ["I fainted yesterday", "urgent"],
  ];
  for (const [text, category] of cases) {
    const r = screenPatientText(text);
    assert.equal(r.triggered, true, text);
    assert.equal(r.category, category, text);
  }
});

test("screen: ordinary complaints do not trigger", () => {
  for (const text of ["mild headache after a long day on screens", "my knee hurts climbing stairs", "a bit tired and low on energy", "stomach pain for four months and some weight loss"]) {
    assert.equal(screenPatientText(text).triggered, false, text);
  }
});

test("screen: crisis outranks medical, and negation is deliberately NOT handled (over-triggers by design)", () => {
  assert.equal(screenPatientText("I had an overdose and I want to die").category, "crisis");
  assert.equal(screenPatientText("I have no chest pain").triggered, true);
});

// ---------------- guidance: tiers ----------------
test("guidance: tier follows the worst red flag", () => {
  const tier = (severity: string) => buildPatientGuidance({ analysis: analysis({ redFlags: [{ label: "x", severity }] }) }).urgency;
  assert.equal(tier("info"), "routine");
  assert.equal(tier("warning"), "soon");
  assert.equal(tier("danger"), "urgent");
  assert.equal(tier("critical"), "emergency");
  assert.equal(tier("something-new"), "soon", "unknown severity must fail safe, not silent");
});

test("guidance: a dangerous diagnosis raises the tier only if it is at least moderately likely", () => {
  const g = (likelihood: string) => buildPatientGuidance({ analysis: analysis({ differential: [{ name: "Serious thing", dangerous: true, likelihood }] }) }).urgency;
  assert.equal(g("low"), "routine");
  assert.equal(g("moderate"), "soon");
  assert.equal(g("high"), "soon");
});

test("guidance: urgency is monotonic — adding a red flag never lowers it", () => {
  const sev = ["info", "warning", "danger", "critical"];
  const lists: string[][] = [[]];
  for (const a of sev) { lists.push([a]); for (const b of sev) { lists.push([a, b]); for (const c of sev) lists.push([a, b, c]); } }
  for (const list of lists) {
    const base = RANK[buildPatientGuidance({ analysis: analysis({ redFlags: list.map((s) => ({ label: "f", severity: s })) }) }).urgency];
    for (const extra of sev) {
      const more = RANK[buildPatientGuidance({ analysis: analysis({ redFlags: [...list, extra].map((s) => ({ label: "f", severity: s })) }) }).urgency];
      assert.ok(more >= base, `[${list}] + ${extra}`);
    }
  }
});

test("guidance: the lowest tier is not an all-clear and still says when to escalate", () => {
  const g = buildPatientGuidance({ analysis: analysis({ redFlags: [{ label: "x", severity: "info" }] }) });
  assert.equal(g.urgency, "routine");
  assert.match(g.headline, /isn't a clearance/);
  assert.ok(g.actions.some((a) => /emergency care/.test(a)));
});

// ---------------- guidance: fail-safe paths ----------------
test("guidance: with no analysis (provider down) it says 'see a clinician soon', never silence", () => {
  const g = buildPatientGuidance({ analysis: null, patientText: "stomach pain for a few months" });
  assert.equal(g.urgency, "soon");
  assert.match(g.headline, /couldn't fully assess/);
  assert.ok(g.basis.includes("fallback:no-analysis"));
});

test("guidance: emergency phrases work with NO analysis at all", () => {
  const g = buildPatientGuidance({ analysis: null, patientText: "I can't breathe" });
  assert.equal(g.urgency, "emergency");
  assert.match(g.actions[0]!, /emergency/);
});

test("guidance: a screen-raised 'urgent' tier keeps its own headline, not the no-analysis one", () => {
  const g = buildPatientGuidance({ analysis: null, patientText: "I've been coughing up blood" });
  assert.equal(g.urgency, "urgent");
  assert.match(g.headline, /within the next day/);
});

test("guidance: crisis text yields a crisis response — no questions, no feature list, no clinical disclaimer", () => {
  for (const analysisInput of [null, analysis({ redFlags: [{ label: "Weight loss", severity: "warning" }] })]) {
    const g = buildPatientGuidance({ analysis: analysisInput, patientText: "I want to die" });
    assert.equal(g.mode, "crisis");
    assert.equal(g.urgency, "emergency");
    assert.deepEqual(g.questionsForYourClinician, []);
    assert.deepEqual(g.featuresToMention, []);
    assert.match(g.actions[0]!, /emergency number or a crisis line/);
  }
});

test("guidance: the screen can raise urgency above the analysis, never below it", () => {
  const low = analysis({ redFlags: [{ label: "x", severity: "info" }] });
  assert.equal(buildPatientGuidance({ analysis: low, patientText: "I fainted" }).urgency, "urgent");
  const high = analysis({ redFlags: [{ label: "x", severity: "critical" }] });
  assert.equal(buildPatientGuidance({ analysis: high, patientText: "mild headache" }).urgency, "emergency");
});

// ---------------- guidance: nothing diagnostic reaches the patient ----------------
test("sanitiser: drops diagnosis names, alarming terms, over-certain language, and overlong text", () => {
  const names = ["Gastric malignancy", "Pancreatic pathology"];
  assert.equal(sanitizePatientFacingText("Unintentional weight loss", names), "Unintentional weight loss");
  assert.equal(sanitizePatientFacingText("Gastric malignancy suspected", names), null);
  assert.equal(sanitizePatientFacingText("Possible CANCER", names), null);
  assert.equal(sanitizePatientFacingText("terminal decline", names), null);
  assert.equal(sanitizePatientFacingText("You definitely have this", names), null);
  assert.equal(sanitizePatientFacingText("   ", names), null);
  assert.equal(sanitizePatientFacingText("x".repeat(121), names), null);
});

test("guidance: adversarial model output never leaks diagnoses, and dropping a label never lowers urgency", () => {
  const g = buildPatientGuidance({
    analysis: {
      redFlags: [
        { label: "Gastric malignancy suspected", severity: "danger", ...({ why: "you definitely have cancer" } as object) },
        { label: "Possible cancer", severity: "warning" },
        { label: "Unintentional weight loss", severity: "warning" },
      ],
      differential: [{ name: "Gastric malignancy", dangerous: true, likelihood: "moderate" }, { name: "Pancreatic pathology", dangerous: true, likelihood: "low" }],
      missingInformation: ["Any family history of cancer?", "Has there been any GI bleeding?", "Describe the symptoms"],
    },
  });
  assert.equal(g.urgency, "urgent", "the dropped 'danger' flag must still count toward urgency");
  assert.deepEqual(g.featuresToMention, ["Unintentional weight loss"]);
  assert.deepEqual(g.questionsForYourClinician, ["Has there been any GI bleeding?"]);
  const text = allText(g).toLowerCase();
  for (const banned of ["malignan", "cancer", "pancreatic", "definitely"]) assert.ok(!text.includes(banned), banned);
});

test("guidance: if every flagged label is unsafe to show, a generic line replaces them", () => {
  const g = buildPatientGuidance({ analysis: analysis({ redFlags: [{ label: "Possible cancer", severity: "warning" }] }) });
  assert.deepEqual(g.featuresToMention, ["Some features of what you've described are ones clinicians take seriously."]);
});

// ---------------- whole-output properties ----------------
test("every reachable output: no over-certain language, no false reassurance, escalation advice present", () => {
  const outputs: PatientGuidance[] = [];
  const sev = ["info", "warning", "danger", "critical"];
  for (const s of sev) for (const dangerous of [false, true]) for (const likelihood of ["low", "moderate", "high"])
    outputs.push(buildPatientGuidance({ analysis: analysis({ redFlags: [{ label: "Unintentional weight loss", severity: s }], differential: [{ name: "Thing", dangerous, likelihood }], missingInformation: ["Any fever?"] }) }));
  for (const t of ["I can't breathe", "I fainted", "I want to die", "just a mild ache"]) { outputs.push(buildPatientGuidance({ analysis: null, patientText: t })); }
  const reassurance = /\b(fine|nothing to worry|no need|all clear|nothing wrong|harmless|perfectly normal)\b/i;
  for (const g of outputs) {
    const text = allText(g);
    assert.deepEqual(checkOvercertainLanguage(text), [], text);
    assert.ok(!reassurance.test(text), `false reassurance in: ${text}`);
    if (g.mode === "standard") assert.ok(g.disclaimer.length > 0);
    if (g.mode === "standard" && g.urgency !== "emergency") assert.ok(g.actions.some((a) => /emergency care/.test(a)), `no escalation advice: ${g.headline}`);
  }
  assert.equal(outputs.length, 4 * 2 * 3 + 4, "matrix size changed — update this check deliberately");
});
