import { demoState, emptyExam, emptyState, type WorkbenchState } from "../src/model.ts";

export interface FerroRegressionCase {
  id: string;
  narrative: string;
  state: WorkbenchState;
}

export function painRich(): WorkbenchState {
  const state = emptyState();
  state.pain.summary = "presence";
  state.pain.laterality = ["right"];
  state.pain.durationNumber = 3;
  state.pain.durationUnit = "day";
  state.pain.choices = {
    AbsolutePainDescriptor: "achingPain",
    AbsoluteFrequency: "infrequent",
    AbsoluteOnset: "gradual",
    AbsoluteSeverity: "moderate",
    AbsoluteProgress: "worse",
    AbsoluteProcessPattern: "single",
  };
  return state;
}

export function bilateral(): WorkbenchState {
  const state = emptyState();
  state.pain.summary = "presence";
  state.pain.laterality = ["left", "right"];
  return state;
}

export function absentSwelling(): WorkbenchState {
  const state = emptyState();
  state.swelling.summary = "absence";
  return state;
}

export function diagnoses(): WorkbenchState {
  const state = emptyState();
  state.diagnoses.ThumbSprain = "possible";
  state.diagnoses.ThumbFracture = "excluded";
  state.diagnoses["Paronychia on Thumb"] = "present";
  return state;
}

export function examPerSide(): WorkbenchState {
  const state = emptyState();
  state.exam.right.tenderness = "presence";
  state.exam.right.flexionRange = "full";
  state.exam.left.status = "notExamined";
  return state;
}

export function examNormal(): WorkbenchState {
  const state = emptyState();
  state.exam.right = emptyExam();
  state.exam.right.status = "normal";
  state.exam.right.tenderness = "absence";
  return state;
}

/** The seven FerroEHR regression cases from the 2026-11-16 cross-check. */
export const ferroRegressionCases: FerroRegressionCase[] = [
  {
    id: "01-demo-1998",
    narrative: "Pain in right thumb\nGradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present",
    state: demoState(),
  },
  {
    id: "02-pain-rich",
    narrative: "Aching, infrequent, gradual onset, moderately severe pain in right thumb for 3 days, worse, single",
    state: painRich(),
  },
  {
    id: "03-bilateral-pain",
    narrative: "Pain in left and right thumbs",
    state: bilateral(),
  },
  {
    id: "04-absent-swelling-chosen",
    narrative: "Absent thumb swelling",
    state: absentSwelling(),
  },
  {
    id: "05-possible-excluded-present",
    narrative: "Possible thumb sprain\nThumb fracture excluded\nParonychia of thumb present",
    state: diagnoses(),
  },
  {
    id: "06-exam-per-side",
    narrative: "Thumb pain",
    state: examPerSide(),
  },
  {
    id: "07-exam-normal-absent-tenderness",
    narrative: "Thumb pain",
    state: examNormal(),
  },
];