# ZipEHR html5.short strict round-trip gaps

With `propertyMode: "comment"`, `layout: "linesaving"`, `symbolVariant: "emoji"` (demo parity), `zipehrHtml5ToCanonical` after `serializeToHtml5Variant` does **not** always equal the workbench canonical JSON byte-for-byte.

Observed on all seven Ferro regression compositions (2026-03-17, bundle from ehrtslib `4153466` + html5 patches pending PR #322):

| Case | Primary losses |
|------|----------------|
| 01-demo-1998, 02-pain-rich | `composer.name` widened to `DV_TEXT`; **sibling order** of `CLUSTER.items` under symptom clusters (e.g. anatomical_location vs onset/duration fields transposed after deserialize) |
| 03-bilateral-pain, 04-absent-swelling-chosen, 06-exam-per-side | `composer.name` only (`PARTY_IDENTIFIED.name` string → `DV_TEXT`) |
| 05-possible-excluded-present, 07-exam-normal-absent-tenderness | `composer.name`; **sibling order** under exam/evaluation clusters (anatomical_location vs interpretation/certainty) |

Clinical payload (coded values, mappings, narrative text) is present in the round-trip tree but order and PARTY_IDENTIFIED shape differ. Fixing this belongs in ehrtslib html5 deserialize (sibling order / `fast-xml-parser` preserveOrder) and/or agreeing canonical JSON shorthand for `composer.name`.