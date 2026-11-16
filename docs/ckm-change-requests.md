# CKM change requests from the thumb pain workbench

Checked against the published Clinical Knowledge Manager archetypes on 16 November 2026. Versions below are the `revision` values in those ADL files.

## Archetypes used

| Archetype | Revision | Role |
|---|---|---|
| openEHR-EHR-COMPOSITION.encounter.v1 | 1.0.12 | Encounter, category 433 |
| openEHR-EHR-SECTION.adhoc.v1 | 1.0.12 | Renamed History, Examination, Assessment |
| openEHR-EHR-OBSERVATION.story.v1 | 1.3.3 | English narrative in Story at0004; present symptoms in Structured detail at0006 |
| openEHR-EHR-CLUSTER.symptom_sign.v2 | 2.1.5 | One cluster per present pain or swelling |
| openEHR-EHR-CLUSTER.anatomical_location.v1 | 1.5.1 | Site, specific site, laterality (at0003 Left, at0004 Right, at0083 Right and left) |
| openEHR-EHR-OBSERVATION.symptom_sign_screening.v1 | 1.0.7 | Explicit absent answers only. Presence at0005 value at0024 No |
| openEHR-EHR-EVALUATION.problem_diagnosis.v1 | 1.7.4 | Present diagnosis. Possible adds Diagnostic certainty at0073 = at0074 Suspected |
| openEHR-EHR-CLUSTER.problem_qualifier.v2 | 2.1.1 | Not nested. See findings below |
| openEHR-EHR-EVALUATION.exclusion_specific.v1 | 1.0.2 | Excluded diagnosis. Excluded concept name constrained to at0004 Problem/diagnosis |
| openEHR-EHR-OBSERVATION.exam.v1 | 1.1.5 | One observation per examined side |
| openEHR-EHR-CLUSTER.exam.v2 | 2.1.3 | Structure examined, body site, interpretation, findings slot |
| openEHR-EHR-CLUSTER.range_of_motion.v1 | 1.0.2 | Flexion at0006, extension at0005, abduction at0003, adduction at0004 |
| openEHR-EHR-CLUSTER.exclusion_exam.v1 | 1.1.2 | "Not examined" as Examination not done = true |
| openEHR-EHR-CLUSTER.clinergy_descriptor.v0 | local 0.0.1 | Frequency, consistency, texture, pain on movement, duration unit |

`CLUSTER.exam-hand.v0` and `CLUSTER.exam-finger.v0` are draft (0.0.1-alpha), so the published `CLUSTER.exam.v2` is used and the thumb is named in System or structure examined.

## problem_qualifier

`CLUSTER.problem_qualifier.v2` (revision 2.1.1, CID 1013.1.6653) does not carry the Clinergy scales this form needs:

- Progression (at0102) repeats Improving / Stable / Worsening, which `symptom_sign` at0180 already has (at0181 Improving, at0182 Unchanged, at0183 Worsening). The thumb form uses the symptom_sign element.
- Course label (at0077) is Acute / Acute-on-chronic / Chronic. That is not single / intermittent / persistent / continuous.
- There is no infrequent / occasional / frequent element. Occurrence (at0071) is first occurrence versus recurrence.
- The archetype says diagnostic certainty belongs on `problem_diagnosis` at0073, not here. Possible diagnoses use at0074 Suspected. Present diagnoses leave certainty empty. Confirmed is not inferred.

Onset type (gradual / rapid / sudden) fits `symptom_sign` Onset timing at0164, whose comment names gradual and sudden, as text. Character fits at0189 as text. Pattern fits at0003 as text. Severity fits the mild / moderate / severe codes at0023–at0025. Duration fits Episode duration at0028 as DV_DURATION.

So problem_qualifier is not placed in the specific-details slot. The slot is used only for the local descriptor cluster.

## Requests

1. Add a frequency value set (infrequent, occasional, frequent) to `symptom_sign` or, if it is judged a problem qualifier, to `problem_qualifier`. Neither archetype has it.
2. Add terminology-friendly value sets, or published bindings, for pain character (aching, piercing, dull, throbbing, pressing, burning), onset type (gradual, rapid, sudden) and pattern (single, intermittent, persistent, continuous). Those nodes are DV_TEXT today.
3. Add a qualitative range (full, reduced, limited, minimal) and pain on movement to `CLUSTER.range_of_motion`. The published element is a quantity in degrees, or a free-text interpretation.
4. Add swelling consistency (soft, firm, hard, fluctuant) and texture (rough, smooth, nodular, irregular), either on `symptom_sign` specific details or a small swelling cluster.
5. Publish `CLUSTER.exam-finger` or a thumb specialisation of `CLUSTER.exam` so tenderness and the four thumb movements are not assembled only from the generic exam cluster. The hand and finger exam archetypes are still draft.
6. Keep `symptom_sign_screening` for explicit absence. Its misuse statement says it is a questionnaire, which is a slightly awkward fit for a single absent answer chosen on a data-entry form. A published "explicitly absent symptom" element that is not a whole questionnaire would be clearer.
