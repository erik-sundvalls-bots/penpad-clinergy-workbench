#!/usr/bin/env python3
"""Embed problem_qualifier.v2 at problem_diagnosis Status (at0046) in thumb OPTs."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPTS = [
    ROOT / "templates/gp-encounter.opt",
    ROOT / "templates/thumb-pain.opt",
    ROOT / "templates/thumb-pain-encounter.v2.opt",
]

CODED_VALUE = """                      <children xsi:type="C_COMPLEX_OBJECT">
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
                        <attributes xsi:type="C_SINGLE_ATTRIBUTE">
                          <rm_attribute_name>defining_code</rm_attribute_name>
                          <existence>
                            <lower_included>true</lower_included>
                            <upper_included>true</upper_included>
                            <lower_unbounded>false</lower_unbounded>
                            <upper_unbounded>false</upper_unbounded>
                            <lower>1</lower>
                            <upper>1</upper>
                          </existence>
                          <children xsi:type="C_CODE_PHRASE">
                            <rm_type_name>CODE_PHRASE</rm_type_name>
                            <occurrences>
                              <lower_included>true</lower_included>
                              <upper_included>true</upper_included>
                              <lower_unbounded>false</lower_unbounded>
                              <upper_unbounded>false</upper_unbounded>
                              <lower>1</lower>
                              <upper>1</upper>
                            </occurrences>
                            <node_id/>
                            <terminology_id>
                              <value>local</value>
                            </terminology_id>
{code_lists}
                          </children>
                        </attributes>
                      </children>"""

def element(node_id: str, codes: list[str]) -> str:
    code_lists = "".join(f"                            <code_list>{code}</code_list>\n" for code in codes)
    return f"""                  <children xsi:type="C_COMPLEX_OBJECT">
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
{CODED_VALUE.format(code_lists=code_lists)}
                    </attributes>
                  </children>"""

PROBLEM_QUALIFIER = """                  <children xsi:type="C_ARCHETYPE_ROOT">
                    <rm_type_name>CLUSTER</rm_type_name>
                    <occurrences>
                      <lower_included>true</lower_included>
                      <upper_included>true</upper_included>
                      <lower_unbounded>false</lower_unbounded>
                      <upper_unbounded>false</upper_unbounded>
                      <lower>0</lower>
                      <upper>1</upper>
                    </occurrences>
                    <node_id>at0046</node_id>
                    <attributes xsi:type="C_MULTIPLE_ATTRIBUTE">
                      <rm_attribute_name>items</rm_attribute_name>
                      <existence>
                        <lower_included>true</lower_included>
                        <upper_included>true</upper_included>
                        <lower_unbounded>false</lower_unbounded>
                        <upper_unbounded>false</upper_unbounded>
                        <lower>0</lower>
                        <upper>1</upper>
                      </existence>
""" + element("at0102", ["at0103", "at0104", "at0105", "at0106"]) + element(
    "at0083", ["at0084", "at0085", "at0086", "at0087"],
) + """
                      <cardinality>
                        <is_ordered>false</is_ordered>
                        <is_unique>false</is_unique>
                        <interval>
                          <lower_included>true</lower_included>
                          <upper_included>false</upper_included>
                          <lower_unbounded>false</lower_unbounded>
                          <upper_unbounded>true</upper_unbounded>
                          <lower>0</lower>
                        </interval>
                      </cardinality>
                    </attributes>
                    <archetype_id>
                      <value>openEHR-EHR-CLUSTER.problem_qualifier.v2</value>
                    </archetype_id>
                    <term_definitions code="at0000">
                      <items id="text">Problem qualifier</items>
                      <items id="description">Structured details of the current status of a problem or diagnosis within a clinical context.</items>
                    </term_definitions>
                    <term_definitions code="at0102">
                      <items id="text">Progression</items>
                    </term_definitions>
                    <term_definitions code="at0083">
                      <items id="text">Resolution phase</items>
                    </term_definitions>
                  </children>"""

COMPONENT_ONTOLOGIES = """
  <component_ontologies archetype_id="openEHR-EHR-CLUSTER.problem_qualifier.v2">
    <term_definitions language="en">
      <items code="at0000"><items id="text">Problem qualifier</items></items>
      <items code="at0102"><items id="text">Progression</items></items>
      <items code="at0103"><items id="text">Improving</items></items>
      <items code="at0104"><items id="text">Stable</items></items>
      <items code="at0105"><items id="text">Worsening</items></items>
      <items code="at0083"><items id="text">Resolution phase</items></items>
      <items code="at0084"><items id="text">Resolved</items></items>
      <items code="at0085"><items id="text">Resolving</items></items>
      <items code="at0086"><items id="text">Not resolving</items></items>
    </term_definitions>
    <term_definitions language="sv">
      <items code="at0102"><items id="text">Progression</items></items>
      <items code="at0103"><items id="text">Förbättras</items></items>
      <items code="at0104"><items id="text">Stabil</items></items>
      <items code="at0105"><items id="text">Försämras</items></items>
      <items code="at0106"><items id="text">Obestämd</items></items>
      <items code="at0083"><items id="text">Resolutionsfas</items></items>
      <items code="at0084"><items id="text">Gått tillbaka</items></items>
      <items code="at0085"><items id="text">Resolution</items></items>
      <items code="at0086"><items id="text">Ej resolution</items></items>
    </term_definitions>
  </component_ontologies>"""

def patch(text: str) -> str:
    needle = (
        "<node_id>at0046</node_id>\n"
        "                    <includes>\n"
        "                      <string_expression>archetype_id/value matches "
        "{/openEHR-EHR-CLUSTER\\.problem_qualifier"
    )
    if needle not in text:
        if "openEHR-EHR-CLUSTER.problem_qualifier.v2</value>" in text and needle not in text:
            print("slot already replaced", file=sys.stderr)
        else:
            raise SystemExit("problem_diagnosis at0046 slot not found")
    else:
        idx = text.index(needle)
        start = text.rfind('<children xsi:type="ARCHETYPE_SLOT">', 0, idx)
        end = text.find("</children>", idx) + len("</children>")
        if start < 0 or end <= start:
            raise SystemExit("could not bound ARCHETYPE_SLOT for at0046")
        text = text[:start] + PROBLEM_QUALIFIER + text[end:]
    if 'archetype_id="openEHR-EHR-CLUSTER.problem_qualifier.v2"' not in text.split("</definitions>")[-1]:
        text = text.replace("</template>", COMPONENT_ONTOLOGIES + "\n</template>", 1)
    return text


def main() -> None:
    for path in OPTS:
        original = path.read_text(encoding="utf-8")
        updated = patch(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            print(f"patched {path.name}")
        else:
            print(f"unchanged {path.name}")


if __name__ == "__main__":
    main()