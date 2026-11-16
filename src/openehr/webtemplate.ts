export const TEMPLATE_ID = "thumb-pain-encounter.v2";

export interface WebNode {
  id: string;
  name: string;
  rmType: string;
  nodeId?: string;
  min?: number;
  max?: number;
  aqlPath?: string;
  children?: WebNode[];
}

const coded = (id: string, name: string, nodeId: string, aqlPath: string): WebNode => ({
  id, name, rmType: "DV_CODED_TEXT", nodeId, aqlPath, min: 0, max: 1,
});

function site(prefix: string): WebNode {
  return {
    id: "body_site",
    name: "Anatomical location",
    rmType: "CLUSTER",
    nodeId: "openEHR-EHR-CLUSTER.anatomical_location.v1",
    min: 0,
    max: 1,
    aqlPath: `${prefix}/items[openEHR-EHR-CLUSTER.anatomical_location.v1]`,
    children: [
      coded("site_name", "Body site name", "at0001", `${prefix}/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0001]`),
      coded("specific_site", "Specific site", "at0065", `${prefix}/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0065]`),
      coded("laterality", "Laterality", "at0002", `${prefix}/items[openEHR-EHR-CLUSTER.anatomical_location.v1]/items[at0002]`),
    ],
  };
}

function descriptor(prefix: string): WebNode {
  const base = `${prefix}/items[openEHR-EHR-CLUSTER.clinergy_descriptor.v0]`;
  return {
    id: "descriptor",
    name: "Clinergy descriptor",
    rmType: "CLUSTER",
    nodeId: "openEHR-EHR-CLUSTER.clinergy_descriptor.v0",
    min: 0,
    max: 1,
    aqlPath: base,
    children: [
      coded("frequency", "Frequency", "at0001", `${base}/items[at0001]`),
      coded("consistency", "Consistency", "at0002", `${base}/items[at0002]`),
      coded("texture", "Texture", "at0003", `${base}/items[at0003]`),
      coded("duration_unit", "Duration unit", "at0005", `${base}/items[at0005]`),
    ],
  };
}

const symptomPrefix = "/content[openEHR-EHR-SECTION.adhoc.v1]/items[openEHR-EHR-OBSERVATION.story.v1]/data[at0001]/events[at0002]/data[at0003]/items[at0006]";

function symptom(): WebNode {
  const p = symptomPrefix;
  return {
    id: "symptom",
    name: "Symptom/Sign",
    rmType: "CLUSTER",
    nodeId: "openEHR-EHR-CLUSTER.symptom_sign.v2",
    min: 0,
    max: -1,
    aqlPath: p,
    children: [
      coded("name", "Symptom/Sign name", "at0001", `${p}/items[at0001]`),
      site(p),
      coded("onset", "Onset timing", "at0164", `${p}/items[at0164]`),
      { id: "duration", name: "Episode duration", rmType: "DV_DURATION", nodeId: "at0028", min: 0, max: 1, aqlPath: `${p}/items[at0028]` },
      coded("severity", "Severity category", "at0021", `${p}/items[at0021]`),
      { ...coded("character", "Character", "at0189", `${p}/items[at0189]`), max: -1 },
      coded("progression", "Progression", "at0180", `${p}/items[at0180]`),
      coded("pattern", "Pattern", "at0003", `${p}/items[at0003]`),
      descriptor(p),
    ],
  };
}

function ensureAql(node: WebNode): WebNode {
  node.aqlPath ??= "";
  node.children?.forEach(ensureAql);
  return node;
}

export const webTemplate = {
  templateId: TEMPLATE_ID,
  version: "2.0",
  defaultLanguage: "en",
  tree: {
    id: TEMPLATE_ID,
    name: "Encounter",
    rmType: "COMPOSITION",
    nodeId: "openEHR-EHR-COMPOSITION.encounter.v1",
    min: 1,
    max: 1,
    children: [
      coded("category", "Category", "at0000", "/category"),
      {
        id: "context",
        name: "Context",
        rmType: "EVENT_CONTEXT",
        min: 1,
        max: 1,
        children: [
          { id: "start_time", name: "Start time", rmType: "DV_DATE_TIME", min: 1, max: 1, aqlPath: "/context/start_time" },
          coded("setting", "Setting", "at0000", "/context/setting"),
        ],
      },
      { id: "composer", name: "Composer", rmType: "PARTY_IDENTIFIED", min: 1, max: 1, aqlPath: "/composer" },
      {
        id: "history",
        name: "History",
        rmType: "SECTION",
        nodeId: "openEHR-EHR-SECTION.adhoc.v1",
        min: 1,
        max: 1,
        aqlPath: "/content[openEHR-EHR-SECTION.adhoc.v1]",
        children: [
          {
            id: "story",
            name: "Story/History",
            rmType: "OBSERVATION",
            nodeId: "openEHR-EHR-OBSERVATION.story.v1",
            min: 1,
            max: 1,
            children: [
              {
                id: "any_event",
                name: "Any event",
                rmType: "EVENT",
                nodeId: "at0002",
                min: 1,
                max: 1,
                children: [
                  { id: "story_text", name: "Story", rmType: "DV_TEXT", nodeId: "at0004", min: 0, max: 1, aqlPath: "/content[openEHR-EHR-SECTION.adhoc.v1]/items[openEHR-EHR-OBSERVATION.story.v1]/data[at0001]/events[at0002]/data[at0003]/items[at0004]" },
                  symptom(),
                ],
              },
            ],
          },
          {
            id: "screening",
            name: "Symptom/sign screening",
            rmType: "OBSERVATION",
            nodeId: "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1",
            min: 0,
            max: 1,
            children: [
              {
                id: "any_event",
                name: "Any event",
                rmType: "EVENT",
                nodeId: "at0002",
                min: 0,
                max: 1,
                children: [
                  {
                    id: "screened",
                    name: "Specific symptom/sign",
                    rmType: "CLUSTER",
                    nodeId: "at0022",
                    min: 0,
                    max: -1,
                    children: [
                      coded("name", "Symptom/sign name", "at0004", ""),
                      coded("presence", "Presence", "at0005", ""),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "examination",
        name: "Examination",
        rmType: "SECTION",
        nodeId: "openEHR-EHR-SECTION.adhoc.v1",
        min: 0,
        max: 1,
        children: [
          {
            id: "exam",
            name: "Physical examination",
            rmType: "OBSERVATION",
            nodeId: "openEHR-EHR-OBSERVATION.exam.v1",
            min: 0,
            max: -1,
            children: [
              {
                id: "any_event",
                name: "Any event",
                rmType: "EVENT",
                nodeId: "at0002",
                min: 1,
                max: 1,
                children: [
                  {
                    id: "detail",
                    name: "Examination findings",
                    rmType: "CLUSTER",
                    nodeId: "openEHR-EHR-CLUSTER.exam.v2",
                    min: 0,
                    max: 1,
                    children: [
                      coded("structure", "System or structure examined", "at0001", ""),
                      site(""),
                      coded("interpretation", "Clinical interpretation", "at0006", ""),
                      {
                        id: "tenderness",
                        name: "Tenderness",
                        rmType: "CLUSTER",
                        nodeId: "openEHR-EHR-CLUSTER.symptom_sign.v2",
                        min: 0,
                        max: 1,
                        children: [coded("name", "Symptom/Sign name", "at0001", "")],
                      },
                      {
                        id: "movement",
                        name: "Range of motion",
                        rmType: "CLUSTER",
                        nodeId: "openEHR-EHR-CLUSTER.range_of_motion.v1",
                        min: 0,
                        max: -1,
                        children: [
                          coded("movement", "Movement", "at0002", ""),
                          coded("interpretation", "Clinical interpretation", "at0035", ""),
                          {
                            id: "descriptor",
                            name: "Pain on movement",
                            rmType: "CLUSTER",
                            nodeId: "openEHR-EHR-CLUSTER.clinergy_descriptor.v0",
                            min: 0,
                            max: 1,
                            children: [coded("pain_on_movement", "Pain on movement", "at0004", "")],
                          },
                        ],
                      },
                      {
                        id: "not_done",
                        name: "Exclusion of examination",
                        rmType: "CLUSTER",
                        nodeId: "openEHR-EHR-CLUSTER.exclusion_exam.v1",
                        min: 0,
                        max: 1,
                        children: [
                          { id: "flag", name: "Examination not done", rmType: "DV_BOOLEAN", nodeId: "at0001", min: 1, max: 1 },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "screening",
            name: "Absent tenderness",
            rmType: "OBSERVATION",
            nodeId: "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1",
            min: 0,
            max: 1,
            children: [
              {
                id: "any_event",
                name: "Any event",
                rmType: "EVENT",
                nodeId: "at0002",
                min: 0,
                max: 1,
                children: [
                  {
                    id: "screened",
                    name: "Specific symptom/sign",
                    rmType: "CLUSTER",
                    nodeId: "at0022",
                    min: 0,
                    max: -1,
                    children: [
                      coded("name", "Symptom/sign name", "at0004", ""),
                      coded("presence", "Presence", "at0005", ""),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "assessment",
        name: "Assessment",
        rmType: "SECTION",
        nodeId: "openEHR-EHR-SECTION.adhoc.v1",
        min: 0,
        max: 1,
        children: [
          {
            id: "problem",
            name: "Problem/Diagnosis",
            rmType: "EVALUATION",
            nodeId: "openEHR-EHR-EVALUATION.problem_diagnosis.v1",
            min: 0,
            max: -1,
            children: [
              coded("name", "Problem/Diagnosis name", "at0002", ""),
              site(""),
              coded("certainty", "Diagnostic certainty", "at0073", ""),
            ],
          },
          {
            id: "exclusion",
            name: "Exclusion - specific",
            rmType: "EVALUATION",
            nodeId: "openEHR-EHR-EVALUATION.exclusion_specific.v1",
            min: 0,
            max: -1,
            children: [
              coded("concept", "Excluded concept", "at0003", ""),
            ],
          },
        ],
      },
    ],
  },
};
ensureAql(webTemplate.tree);
