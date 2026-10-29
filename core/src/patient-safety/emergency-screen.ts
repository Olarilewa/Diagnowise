/**
 * Diagnowise core — emergency screen for a patient's own words.
 *
 * Deterministic and model-free ON PURPOSE: the most safety-critical check in
 * the patient product must keep working when an AI provider is down, slow,
 * or wrong. Plain phrase matching, run on the patient's text before and
 * independently of any analysis.
 *
 * It deliberately OVER-triggers. "I have no chest pain" still matches,
 * because a missed emergency costs far more than an unnecessary
 * "get care now" screen. Negation handling is a known non-goal.
 *
 * LIMITS — read before shipping: English only; the phrase lists are a
 * starting point and need review by clinicians and by speakers of each
 * language/region the product launches in.
 */

export type EmergencyCategory = "crisis" | "medical" | "urgent";

export interface EmergencyScreenResult {
  triggered: boolean;
  category?: EmergencyCategory;
  matched: string[];
}

type Rule = { label: string; pattern: RegExp };

const CRISIS: Rule[] = [
  { label: "suicidal language", pattern: /\bsuicid\w*|\bkill(ing)? myself\b|\bend(ing)? my (own )?life\b|\b(want|wanted|wanting|wanna) (to )?die\b|\bbetter off (dead|without me)\b|\bdon'?t want to (live|be alive)\b/ },
  { label: "self-harm language", pattern: /\b(hurt|hurting|harm|harming) myself\b|\bself[- ]harm\b/ },
];

const MEDICAL: Rule[] = [
  { label: "chest pain or pressure", pattern: /\bchest (pain|pains|pressure|tightness|discomfort)\b|\b(pain|pressure|tightness) in (my |the )?chest\b/ },
  { label: "breathing difficulty", pattern: /\b(can'?t|cannot|can not|unable to) (breathe|get (my )?breath)\b|\b(difficulty|trouble|struggling) (to )?breath(e|ing)\b|\bgasping\b/ },
  { label: "vomiting blood", pattern: /\bvomit(ing|ed)? (up )?blood\b|\bthrowing up blood\b|\bblood in (my )?vomit\b/ },
  { label: "severe bleeding", pattern: /\b(severe|heavy|uncontrolled) bleeding\b|\bwon'?t stop bleeding\b|\bbleeding (heavily|a lot)\b/ },
  { label: "loss of consciousness or seizure", pattern: /\bseizure\b|\bconvuls\w*|\bunresponsive\b|\bunconscious\b|\bnot waking up\b|\bwon'?t wake up\b/ },
  { label: "stroke signs", pattern: /\bface (is )?(drooping|droops)\b|\bslurred speech\b|\bsudden(ly)? (weakness|numbness|confusion)\b|\b(numb|numbness|weak|weakness) on one side\b|\bworst headache of my life\b/ },
  { label: "severe allergic reaction", pattern: /\b(throat|tongue|face|lips) (is )?(swelling|swollen)\b|\bswelling of (my |the )?(throat|tongue|face|lips)\b|\bcan'?t swallow\b|\bsevere allergic reaction\b|\banaphyla\w*/ },
  { label: "poisoning or overdose", pattern: /\boverdos\w*|\bswallowed (poison|bleach|pills)\b|\bpoison(ed|ing)\b/ },
];

const URGENT: Rule[] = [
  { label: "coughing up blood", pattern: /\bcough(ing|ed)? up blood\b|\bblood[- ]streaked\b/ },
  { label: "blood in stool or urine", pattern: /\bblood in (my )?(stool|poop|urine|pee)\b|\b(black|tarry) (stool|stools|poop)\b/ },
  { label: "fainting or collapse", pattern: /\b(fainted|passed out|blacked out|collapsed)\b/ },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, " ");
}
function hits(rules: Rule[], t: string): string[] {
  return rules.filter((r) => r.pattern.test(t)).map((r) => r.label);
}

/** Crisis outranks medical, which outranks urgent. */
export function screenPatientText(text: string): EmergencyScreenResult {
  const t = normalize(text);
  for (const [category, rules] of [["crisis", CRISIS], ["medical", MEDICAL], ["urgent", URGENT]] as const) {
    const matched = hits(rules, t);
    if (matched.length > 0) return { triggered: true, category, matched };
  }
  return { triggered: false, matched: [] };
}
