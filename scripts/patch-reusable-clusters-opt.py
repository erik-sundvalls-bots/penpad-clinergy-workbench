#!/usr/bin/env python3
"""Patch thumb OPT files: replace clinergy_descriptor with reusable cluster archetypes."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPTS = [
    ROOT / "templates/thumb-pain.opt",
    ROOT / "templates/gp-encounter.opt",
    ROOT / "templates/thumb-pain-encounter.v2.opt",
]

CODED_ELEMENT = """                                  <children xsi:type="C_COMPLEX_OBJECT">
                                    <rm_type_name>ELEMENT</rm_type_name>
                                    <occurrences>
                                      <lower_included>true</lower_included>
                                      <upper_included>true</upper_included>
                                      <lower_unbounded>false</lower_unbounded>
                                      <upper_unbounded>false</upper_unbounded>
                                      <lower>0</lower>
                                      <upper>1</upper>
                                    </occurrences>
                                    <node_id>{node_id}</node_id>
                                    <attributes xsi:type="C_SINGLE_ATTRIBUTE">
                                      <rm_attribute_name>value</rm_attribute_name>
                                      <existence>
                                        <lower_included>true</lower_included>
                                        <upper_included>true</upper_included>
                                        <lower_unbounded>false</lower_unbounded>
                                        <upper_unbounded>false</upper_unbounded>
                                        <lower>0</lower>
                                        <upper>1</upper>
                                      </existence>
                                      <children xsi:type="C_COMPLEX_OBJECT">
                                        <rm_type_name>DV_CODED_TEXT</rm_type_name>
                                        <occurrences>
                                          <lower_included>true</lower_included>
                                          <upper_included>true</upper_included>
                                          <lower_unbounded>false</lower_unbounded>
                                          <upper_unbounded>false</upper_unbounded>
                                          <lower>1</lower>
                                          <upper>1</upper>
                                        </occurrences>
                                        <node_id/>
                                      </children>
                                    </attributes>
                                  </children>"""

HISTORY_FREQUENCY = """                              <children xsi:type="C_ARCHETYPE_ROOT">
                                <rm_type_name>CLUSTER</rm_type_name>
                                <occurrences>
                                  <lower_included>true</lower_included>
                                  <upper_included>true</upper_included>
                                  <lower_unbounded>false</lower_unbounded>
                                  <upper_unbounded>false</upper_unbounded>
                                  <lower>0</lower>
                                  <upper>1</upper>
                                </occurrences>
                                <node_id>at0000</node_id>
                                <attributes xsi:type="C_MULTIPLE_ATTRIBUTE">
                                  <rm_attribute_name>items</rm_attribute_name>
                                  <existence>
                                    <lower_included>true</lower_included>
                                    <upper_included>true</upper_included>
                                    <lower_unbounded>false</lower_unbounded>
                                    <upper_unbounded>false</upper_unbounded>
                                    <lower>1</lower>
                                    <upper>1</upper>
                                  </existence>
""" + CODED_ELEMENT.format(node_id="at0001") + """
                                  <cardinality>
                                    <is_ordered>false</is_ordered>
                                    <is_unique>false</is_unique>
                                    <interval>
                                      <lower_included>true</lower_included>
                                      <upper_included>false</upper_included>
                                      <lower_unbounded>false</lower_unbounded>
                                      <upper_unbounded>true</upper_unbounded>
                                      <lower>1</lower>
                                    </interval>
                                  </cardinality>
                                </attributes>
                                <archetype_id>
                                  <value>openEHR-EHR-CLUSTER.symptom_sign_frequency.v0</value>
                                </archetype_id>
                                <term_definitions code="at0000">
                                  <items id="text">Symptom/sign frequency</items>
                                  <items id="description">How often episodes of an identified symptom or sign occur.</items>
                                </term_definitions>
                                <term_definitions code="at0001">
                                  <items id="text">Frequency category</items>
                                  <items id="description">Category describing how often episodes of the symptom or sign occur.</items>
                                </term_definitions>
                              </children>
                              <children xsi:type="C_ARCHETYPE_ROOT">
                                <rm_type_name>CLUSTER</rm_type_name>
                                <occurrences>
                                  <lower_included>true</lower_included>
                                  <upper_included>true</upper_included>
                                  <lower_unbounded>false</lower_unbounded>
                                  <upper_unbounded>false</upper_unbounded>
                                  <lower>0</lower>
                                  <upper>1</upper>
                                </occurrences>
                                <node_id>at0000</node_id>
                                <attributes xsi:type="C_MULTIPLE_ATTRIBUTE">
                                  <rm_attribute_name>items</rm_attribute_name>
                                  <existence>
                                    <lower_included>true</lower_included>
                                    <upper_included>true</upper_included>
                                    <lower_unbounded>false</lower_unbounded>
                                    <upper_unbounded>false</upper_unbounded>
                                    <lower>1</lower>
                                    <upper>1</upper>
                                  </existence>
""" + CODED_ELEMENT.format(node_id="at0001") + CODED_ELEMENT.format(node_id="at0006") + """
                                  <cardinality>
                                    <is_ordered>false</is_ordered>
                                    <is_unique>false</is_unique>
                                    <interval>
                                      <lower_included>true</lower_included>
                                      <upper_included>false</upper_included>
                                      <lower_unbounded>false</lower_unbounded>
                                      <upper_unbounded>true</upper_unbounded>
                                      <lower>1</lower>
                                    </interval>
                                  </cardinality>
                                </attributes>
                                <archetype_id>
                                  <value>openEHR-EHR-CLUSTER.palpation_characteristics.v0</value>
                                </archetype_id>
                                <term_definitions code="at0000">
                                  <items id="text">Palpation characteristics</items>
                                  <items id="description">Tactile characteristics of a swelling, mass, lesion or organ, as felt on palpation.</items>
                                </term_definitions>
                                <term_definitions code="at0001">
                                  <items id="text">Consistency</items>
                                  <items id="description">How the swelling, mass, lesion or organ feels on palpation.</items>
                                </term_definitions>
                                <term_definitions code="at0006">
                                  <items id="text">Surface texture</items>
                                  <items id="description">The texture of the surface on palpation.</items>
                                </term_definitions>
                              </children>"""

def replace_clinergy_before(text: str, following_node: str, replacement: str) -> str:
    marker = "<value>openEHR-EHR-CLUSTER.clinergy_descriptor.v0</value>"
    follow = f"<node_id>{following_node}</node_id>"
    idx = 0
    while True:
        mi = text.find(marker, idx)
        if mi == -1:
            raise SystemExit(f"No clinergy block remaining (wanted before {following_node})")
        start = text.rfind('<children xsi:type="C_ARCHETYPE_ROOT">', 0, mi)
        follow_at = text.find(follow, mi)
        if follow_at == -1:
            idx = mi + 1
            continue
        end = text.rfind("</children>", mi, follow_at) + len("</children>")
        whitespace = text[end : text.find("<", end)]
        return text[:start] + replacement + whitespace + text[end:]

ROM_EXTRA = CODED_ELEMENT.format(node_id="at0.1") + CODED_ELEMENT.format(node_id="at0.7")

COMPONENT_FREQUENCY = """  <component_ontologies archetype_id="openEHR-EHR-CLUSTER.symptom_sign_frequency.v0">
    <term_definitions language="en">
      <items code="at0000"><items id="text">Symptom/sign frequency</items></items>
      <items code="at0001"><items id="text">Frequency category</items></items>
      <items code="at0002"><items id="text">Infrequent</items></items>
      <items code="at0003"><items id="text">Occasional</items></items>
      <items code="at0004"><items id="text">Frequent</items></items>
    </term_definitions>
    <term_definitions language="sv">
      <items code="at0000"><items id="text">Frekvens för symtom/tecken</items></items>
      <items code="at0001"><items id="text">Frekvenskategori</items></items>
      <items code="at0002"><items id="text">Sällan</items></items>
      <items code="at0003"><items id="text">Ibland</items></items>
      <items code="at0004"><items id="text">Ofta</items></items>
    </term_definitions>
  </component_ontologies>
  <component_ontologies archetype_id="openEHR-EHR-CLUSTER.palpation_characteristics.v0">
    <term_definitions language="en">
      <items code="at0000"><items id="text">Palpation characteristics</items></items>
      <items code="at0001"><items id="text">Consistency</items></items>
      <items code="at0002"><items id="text">Soft</items></items>
      <items code="at0003"><items id="text">Firm</items></items>
      <items code="at0004"><items id="text">Hard</items></items>
      <items code="at0005"><items id="text">Fluctuant</items></items>
      <items code="at0006"><items id="text">Surface texture</items></items>
      <items code="at0007"><items id="text">Smooth</items></items>
      <items code="at0008"><items id="text">Rough</items></items>
      <items code="at0009"><items id="text">Nodular</items></items>
      <items code="at0010"><items id="text">Irregular</items></items>
    </term_definitions>
    <term_definitions language="sv">
      <items code="at0000"><items id="text">Palpationsfynd</items></items>
      <items code="at0001"><items id="text">Konsistens</items></items>
      <items code="at0002"><items id="text">Mjuk</items></items>
      <items code="at0003"><items id="text">Fast</items></items>
      <items code="at0004"><items id="text">Hård</items></items>
      <items code="at0005"><items id="text">Fluktuerande</items></items>
      <items code="at0006"><items id="text">Ytstruktur</items></items>
      <items code="at0007"><items id="text">Slät</items></items>
      <items code="at0008"><items id="text">Grov</items></items>
      <items code="at0009"><items id="text">Knölig</items></items>
      <items code="at0010"><items id="text">Oregelbunden</items></items>
    </term_definitions>
  </component_ontologies>
  <component_ontologies archetype_id="openEHR-EHR-CLUSTER.range_of_motion-qualitative.v0">
    <term_definitions language="en">
      <items code="at0000"><items id="text">Qualitative range of motion of a joint</items></items>
      <items code="at0.1"><items id="text">Qualitative range</items></items>
      <items code="at0.2"><items id="text">Full</items></items>
      <items code="at0.3"><items id="text">Reduced</items></items>
      <items code="at0.4"><items id="text">Limited</items></items>
      <items code="at0.5"><items id="text">Minimal</items></items>
      <items code="at0.6"><items id="text">Fixed</items></items>
      <items code="at0.7"><items id="text">Pain on movement</items></items>
      <items code="at0.8"><items id="text">No pain</items></items>
      <items code="at0.9"><items id="text">Mild pain</items></items>
      <items code="at0.10"><items id="text">Moderate pain</items></items>
      <items code="at0.11"><items id="text">Severe pain</items></items>
    </term_definitions>
    <term_definitions language="sv">
      <items code="at0000"><items id="text">Kvalitativ rörelseomfång för led</items></items>
      <items code="at0.1"><items id="text">Kvalitativt rörelseomfång</items></items>
      <items code="at0.2"><items id="text">Fullt</items></items>
      <items code="at0.3"><items id="text">Nedsatt</items></items>
      <items code="at0.4"><items id="text">Begränsat</items></items>
      <items code="at0.5"><items id="text">Minimalt</items></items>
      <items code="at0.6"><items id="text">Fixerat</items></items>
      <items code="at0.7"><items id="text">Smärta vid rörelse</items></items>
      <items code="at0.8"><items id="text">Ingen smärta</items></items>
      <items code="at0.9"><items id="text">Lätt smärta</items></items>
      <items code="at0.10"><items id="text">Måttlig smärta</items></items>
      <items code="at0.11"><items id="text">Svår smärta</items></items>
    </term_definitions>
  </component_ontologies>
"""

CLINERGY_ONT_RE = re.compile(
    r"  <component_ontologies archetype_id=\"openEHR-EHR-CLUSTER\.clinergy_descriptor\.v0\">.*?</component_ontologies>\n",
    re.DOTALL,
)

HIDE_FORM_RE = re.compile(
    r"  <annotations path=\"[^\"]*clinergy_descriptor[^\"]*\">.*?</annotations>\n",
    re.DOTALL,
)

L10N_ANNOTATIONS = """  <annotations path="/content[openEHR-EHR-SECTION.adhoc.v1 and name/value='History']/items[openEHR-EHR-OBSERVATION.story.v1]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.symptom_sign.v2]/items[openEHR-EHR-CLUSTER.symptom_sign_frequency.v0]">
    <items id="L10n.en">Symptom/sign frequency</items>
    <items id="L10n.sv">Frekvens för symtom/tecken</items>
  </annotations>
  <annotations path="/content[openEHR-EHR-SECTION.adhoc.v1 and name/value='History']/items[openEHR-EHR-OBSERVATION.story.v1]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.symptom_sign.v2]/items[openEHR-EHR-CLUSTER.palpation_characteristics.v0]">
    <items id="L10n.en">Palpation characteristics</items>
    <items id="L10n.sv">Palpationsfynd</items>
  </annotations>
  <annotations path="/content[openEHR-EHR-SECTION.adhoc.v1 and name/value='Examination']/items[openEHR-EHR-OBSERVATION.exam.v1]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.exam.v2]/items[openEHR-EHR-CLUSTER.range_of_motion-qualitative.v0]/items[at0.1]">
    <items id="L10n.en">Qualitative range</items>
    <items id="L10n.sv">Kvalitativt rörelseomfång</items>
  </annotations>
  <annotations path="/content[openEHR-EHR-SECTION.adhoc.v1 and name/value='Examination']/items[openEHR-EHR-OBSERVATION.exam.v1]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.exam.v2]/items[openEHR-EHR-CLUSTER.range_of_motion-qualitative.v0]/items[at0.7]">
    <items id="L10n.en">Pain on movement</items>
    <items id="L10n.sv">Smärta vid rörelse</items>
  </annotations>
"""


def patch_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if not text.count("clinergy_descriptor"):
        print(f"{path.name}: already patched?")
        return
    text = replace_clinergy_before(text, "at0161", HISTORY_FREQUENCY)
    text = replace_clinergy_before(text, "at0029", ROM_EXTRA)
    text = text.replace(
        "openEHR-EHR-CLUSTER.range_of_motion.v1",
        "openEHR-EHR-CLUSTER.range_of_motion-qualitative.v0",
    )
    text = CLINERGY_ONT_RE.sub(COMPONENT_FREQUENCY, text, count=1)
    text = HIDE_FORM_RE.sub("", text)
    if "symptom_sign_frequency.v0" not in text:
        text = text.replace("<view>", L10N_ANNOTATIONS + "  <view>", 1)
    text = text.replace(
        '<term_definitions code="at0153">\n                              <items id="text">Clinergy descriptor</items>',
        '<term_definitions code="at0153">\n                              <items id="text">Specific details</items>',
    )
    text = text.replace(
        '<items code="at0153">\n        <items id="text">Clinergy descriptor</items>',
        '<items code="at0153">\n        <items id="text">Specific details</items>',
    )
    path.write_text(text, encoding="utf-8")
    print(f"Patched {path.name}")


def main() -> None:
    for opt in OPTS:
        patch_file(opt)


if __name__ == "__main__":
    main()