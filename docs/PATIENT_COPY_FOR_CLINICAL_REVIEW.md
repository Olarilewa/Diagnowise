# Patient-facing copy — for clinical review

Every sentence a patient can see from the guidance layer, generated directly from the code.
No model writes any of it. Items in <angle brackets> are the only variable parts: short red-flag labels
and questions from the analysis, shown only after sanitising (no diagnosis names, no alarming terms,
no over-certain language).

**This is DRAFT wording and has not been clinically reviewed.** It also needs localisation.
Please review in particular: the tier thresholds, the 'emergency care' escalation line, the crisis wording,
and the phrase lists in `core/src/patient-safety/emergency-screen.ts` (English only).

## Routine (analysis found no warning signs)

**Headline:** We didn't pick up warning signs in what you shared, but this isn't a clearance. Only a clinician who examines you can say that.

**Actions:**
- Mention this at your next appointment, or book one if it continues.
- If it gets worse, or new symptoms appear, see a clinician sooner. Go to emergency care straight away for chest pain, difficulty breathing, severe bleeding or confusion.
- Bring a note of your symptoms, when they started, your medications and any previous diagnoses.

**Disclaimer:** This is general guidance based on what you told us. It is not a diagnosis and does not replace a clinician.

## Soon (a warning-level red flag)

**Headline:** Please arrange to see a clinician in the next few days.

**Actions:**
- Book an appointment with a clinician in the next few days.
- If it gets worse, or new symptoms appear, see a clinician sooner. Go to emergency care straight away for chest pain, difficulty breathing, severe bleeding or confusion.
- Bring a note of your symptoms, when they started, your medications and any previous diagnoses.

**Features to mention:**
- <red-flag label, sanitised>

**Disclaimer:** This is general guidance based on what you told us. It is not a diagnosis and does not replace a clinician.

## Urgent (a danger-level red flag)

**Headline:** Please get this checked by a clinician within the next day or so.

**Actions:**
- Contact a clinician today, or within the next day, to be seen in person.
- If it gets worse, or new symptoms appear, see a clinician sooner. Go to emergency care straight away for chest pain, difficulty breathing, severe bleeding or confusion.
- Bring a note of your symptoms, when they started, your medications and any previous diagnoses.

**Features to mention:**
- <red-flag label, sanitised>

**Disclaimer:** This is general guidance based on what you told us. It is not a diagnosis and does not replace a clinician.

## Emergency (a critical red flag, or an emergency phrase in the patient's text)

**Headline:** What you've described may need emergency care right now.

**Actions:**
- Call your local emergency number or go to the nearest emergency department now.
- If you can, have someone with you, and don't drive yourself.
- Tell the emergency team exactly what you've been experiencing.

**Disclaimer:** This is general guidance based on what you told us. It is not a diagnosis and does not replace a clinician.

## No analysis available (provider down)

**Headline:** We couldn't fully assess this, so please speak to a clinician in the next few days.

**Actions:**
- Book an appointment with a clinician in the next few days.
- If it gets worse, or new symptoms appear, see a clinician sooner. Go to emergency care straight away for chest pain, difficulty breathing, severe bleeding or confusion.
- Bring a note of your symptoms, when they started, your medications and any previous diagnoses.

**Disclaimer:** This is general guidance based on what you told us. It is not a diagnosis and does not replace a clinician.

## Crisis (self-harm language in the patient's text)

**Headline:** You don't have to face this alone, and help is available right now.

**Actions:**
- Contact your local emergency number or a crisis line in your country right now.
- If you can, tell someone near you how you're feeling and ask them to stay with you.
- If you've taken something that could harm you, get emergency care immediately.

---

# AI-written explanation and possible diagnoses (added in Phase 5b)

Unlike everything above, this text is written by a model, so it cannot be listed in advance. What a clinician can
review is (1) the fixed text around it, (2) the instructions the model is given, and (3) a batch of real outputs.
**(3) has not been possible yet: no live model key was available when this was built. Please do it before launch.**

## Fixed text (set by code; the model cannot change it)
- **Banner:** Possible explanations, not a diagnosis
- **Under the banner:** Please see a clinician before starting any treatment.
- **Tag on a condition that can be serious:** Can be serious. Needs a clinician's assessment
- **Disclaimer:** These are possible explanations, not a diagnosis. They are here only to help you understand what might be going on. The list is not complete: other causes, including serious ones, are possible, and only a clinician who examines you can say what is wrong. Please see a clinician before starting any treatment, and do not treat yourself based on this.

## What is shown, in order
1. Urgency guidance (fixed copy, above)  2. "What might be going on" (model-written overview)  3. The banner
4. Possible conditions, each with what it is and why it could fit (and, for non-serious ones only, what makes it less likely)
5. Questions to ask a clinician  6. The disclaimer

## Rules applied to the model's text (the whole reply is rejected if any is broken)
Reassurance, ruling-out, treatment/doses/home remedies, statistics, and diagnostic certainty. Conditions not in the
pipeline's differential are dropped. A moderately/highly likely serious condition may not be omitted.

## The instructions the model receives
```
You write for a patient with no medical training who has described their symptoms.
Your job is to help them understand what MIGHT be going on, using ONLY the analysis you are given.

Write in plain, warm, calm language (aim for a reading age of about 12). Short sentences.

STRUCTURE
1. "overview": 2 to 4 short paragraphs explaining, in detail, what might be going on and why their symptoms could fit together. Say what the possibilities have in common and how they differ. Explain medical words you use.
2. "conditions": one entry for each condition in the list you are given, using the name EXACTLY as listed. For each: what it is, why it could fit what they described, and what makes it less likely.
3. "questions_to_ask": up to 5 questions the patient could ask a clinician.

HARD RULES (a reply that breaks any of these is thrown away unread)
- Only discuss the conditions in the list. Never add another condition.
- Use hedged words: may, might, could, possible. NEVER write the words "you have". Say "if there is a fever" instead of "if you have a fever".
- Never say a condition is harmless, benign, mild, not serious, or nothing to worry about. Never tell them not to worry. Never say anything is ruled out or can be excluded.
- Never give treatment: no medicines, doses, home remedies, creams, supplements, or "things to try". Do not tell them to start or stop anything.
- No numbers about how likely or common something is: no percentages, no "1 in 10".
- Do not say what the patient definitely has, and do not write as if you examined them.
- You may say a condition can be serious, and that a clinician needs to assess it.
- For any condition marked "can be serious", leave "what_makes_it_less_likely" empty.

Respond with JSON only, in exactly this shape:
{ "overview": string[], "conditions": [ { "name": string, "what_it_is": string, "why_it_could_fit": string[], "what_makes_it_less_likely": string[] } ], "questions_to_ask": string[] }
```

## Please check
- Is the wording of the banner, tag and disclaimer right for your patients and country?
- Across a varied batch of real outputs: does anything reassure, alarm unnecessarily, or sound like advice?
- Is it acceptable that remote serious possibilities are not listed, given the disclaimer says the list is incomplete?

