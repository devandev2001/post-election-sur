/** FA name list — matches Google Form "Foot-Ball Survey_Kerala 2026 May". */
export const FA_NAMES = [
  "A Prasad",
  "Akhil R",
  "Ananthan",
  "Ananthu R Pillai",
  "Anilkumar S",
  "Anukrishna",
  "Aravind A",
  "Aromal",
  "Arun AS",
  "Deepak",
  "Jijo",
  "Ragesh Ambadi",
  "Saneesh V Anand",
  "Sreehari Chirukandath",
];

export const ALLIANCES = ["LDF", "NDA", "UDF"];

/** 2021 vote dropdown includes NA (not applicable / did not vote / refused, etc.). */
export const VOTE_2021_OPTIONS = [...ALLIANCES, "NA"];

/**
 * When 2021 ≠ 2026, reasons for the 2026 choice.
 * UDF / LDF / NDA match Google Form "Post Poll Survey_Kerala 2026 May".
 */
export const REASONS_BY_2026 = {
  /** Shown when 2026 = UDF and vote changed — matches form section "Why UDF?" */
  UDF: [
    { id: "anti_incumbency_ldf", label: "Anti Incumbency Against LDF Government" },
    { id: "welfare_udf", label: "Welfare And Freebies Promises By UDF" },
    { id: "minority_consolidation", label: "Minority Consolidation" },
    { id: "defeat_bjp", label: "To Defeat BJP" },
    { id: "good_candidate", label: "GOOD CANDIDATE" },
    { id: "other", label: "Other", other: true },
  ],
  LDF: [
    { id: "good_governance", label: "Good Governance" },
    { id: "good_leadership", label: "Good Leadership" },
    { id: "influence_candidate", label: "Influence Of The Candidate" },
    { id: "defeat_bjp", label: "To Defeat BJP" },
    { id: "good_candidate", label: "GOOD CANDIDATE" },
    { id: "other", label: "Other", other: true },
  ],
  /** Shown when 2026 = NDA and vote changed — matches form section "Why NDA?" */
  NDA: [
    { id: "alliance_2020_bdjs", label: "Alliance With Twenty-Twenty And BDJS" },
    { id: "nda_good_leadership", label: "Good Leadership" },
    { id: "winability_perception", label: "Winability Perception" },
    { id: "manifesto", label: "Manifesto" },
    { id: "need_change", label: "Need For A Change" },
    { id: "modi_factor", label: "Modi Factor" },
    { id: "good_candidate", label: "GOOD CANDIDATE" },
    { id: "other", label: "Other", other: true },
  ],
};
