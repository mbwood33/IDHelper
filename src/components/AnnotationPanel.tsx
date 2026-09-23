import { useEffect, useState } from "react";
import { EQP_PREFIXES, type Annotation, type IdRecommendation, type IdType } from "./types";
import type { GeneratedIdentifierState } from "../reports/generatedJson";

/** Callback contract between the review panel and its owning application state. */
interface Props {
  /** Candidate whose details are currently displayed; absent before selection. */
  annotation?: Annotation;
  /** Records an accept/reject review outcome for the selected candidate. */
  onDecision: (decision: "accepted" | "rejected") => void;
  /** Receives a human-corrected candidate and optional explanatory note. */
  onChange: (annotation: Annotation, note?: string) => void;
  /**
   * Optional pure generator supplied by the app. It returns only a synthetic
   * raw identifier, keeping domain generation outside presentation code.
   */
  onGenerate?: (recommendation: IdRecommendation, eqpPrefix?: string) => string | undefined;
  /** Previously generated values and per-value JSON inclusion state. */
  generatedIds?: Partial<Record<IdType, GeneratedIdentifierState>>;
  /** Stores or replaces the generated value for the selected annotation/type. */
  onGenerated: (type: IdType, value: string) => void;
  /** Toggles whether one generated value participates in JSON serialization. */
  onInclusionChange: (type: IdType, included: boolean) => void;
}

/** Converts a 0–1 confidence score into the concise visual label shown in UI. */
function percent(value: number) { return `${Math.round(value * 100)}%`; }

/** Complete ordered list for correction checkboxes; order is deliberate and stable. */
const ID_TYPES: IdType[] = ["SCONUM", "BE", "BE_OSUFFIX", "SK", "EQPCODE", "CENOT", "ELNOT"];

/** User-facing entity-class choices for a manual correction. */
const ENTITY_CLASSES = [
  ["vessel", "Named vessel / maritime platform"],
  ["facility", "Facility / installation / site"],
  ["equipment", "Equipment type / model"],
  ["communications-signal", "Communications signal / emitter"],
  ["electronic-signal", "Electronic signal / emitter"],
  ["other-indexed-entity", "Other possibly indexed entity"],
] as const;

/**
 * Persistent review/detail panel for one selected annotation.
 *
 * The component deliberately does not modify the report. It keeps temporary
 * generation and correction state locally, then communicates decisions through
 * callbacks so the parent owns persistence and analysis state.
 *
 * @param annotation The selected exact-span candidate, if one exists.
 * @param onDecision Callback for accept/reject outcomes.
 * @param onChange Callback for a validated user correction.
 * @param onGenerate Optional identifier generator; absence disables generation.
 * @param generatedIds Values already generated for this annotation.
 * @param onGenerated Callback receiving a newly generated type/value pair.
 * @param onInclusionChange Callback controlling JSON-export membership.
 * @returns An accessible empty prompt or the full annotation review controls.
 */
export function AnnotationPanel({ annotation, onDecision, onChange, onGenerate, generatedIds, onGenerated, onInclusionChange }: Props) {
  /** Type most recently copied, used only to provide immediate success feedback. */
  const [copied, setCopied] = useState<string>();
  /** User-selected or analyzer-suggested EQPCODE category prefix. */
  const [prefix, setPrefix] = useState("G");
  /** Recoverable clipboard-permission/error message shown beside selectable ID text. */
  const [copyProblem, setCopyProblem] = useState<string>();
  /** Whether the manual correction form is visible. */
  const [editing, setEditing] = useState(false);
  /** Draft entity class used only until the reviewer saves a correction. */
  const [editedClass, setEditedClass] = useState("other-indexed-entity");
  /** Draft possible identifier types, controlled by correction checkboxes. */
  const [editedTypes, setEditedTypes] = useState<IdType[]>([]);
  /** Optional reviewer rationale retained with the correction history. */
  const [editNote, setEditNote] = useState("");
  /** Validation message for an incomplete correction form. */
  const [editProblem, setEditProblem] = useState<string>();

  /**
   * Resets ephemeral UI state whenever a different annotation is selected.
   * It adopts a valid EQPCODE suggestion when present, otherwise retains the
   * safe default. The dependency is the ID rather than object identity so
   * equivalent re-renders do not erase in-progress edits.
   */
  useEffect(() => {
    const suggested = annotation?.possibleIdTypes.find((item) => item.type === "EQPCODE")?.eqpPrefix;
    if (suggested && EQP_PREFIXES.some(([code]) => code === suggested)) setPrefix(suggested);
    setCopied(undefined);
    setCopyProblem(undefined);
    setEditing(false);
    setEditedClass(annotation?.entityClass ?? "other-indexed-entity");
    setEditedTypes(annotation?.possibleIdTypes.map((item) => item.type) ?? []);
    setEditNote("");
    setEditProblem(undefined);
  }, [annotation?.id]);

  // An explicit labelled empty state explains how keyboard and mouse users can proceed.
  if (!annotation) return <aside className="panel panel--empty" aria-label="Annotation details"><p className="eyebrow">Annotation details</p><h2>Select a highlight</h2><p>Choose a highlighted phrase in the analyzed report to review its possible IDs and create a value.</p></aside>;

  /**
   * Requests one synthetic value and stores it under its ID type for display.
   * @param recommendation The selected recommendation; EQPCODE receives the
   * current category prefix while all other generators receive no prefix.
   */
  const generate = (recommendation: IdRecommendation) => {
    const value = onGenerate?.(recommendation, recommendation.type === "EQPCODE" ? prefix : undefined);
    if (value) onGenerated(recommendation.type, value);
  };
  /**
   * Copies only a generated raw ID. Clipboard denial is expected in some
   * browser/security contexts, so failure leaves the selectable input visible
   * and exposes a non-disruptive status message.
   * @param type ID type whose generated value should be copied.
   */
  const copy = async (type: IdType) => {
    const value = generatedIds?.[type]?.value;
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(type); setCopyProblem(undefined); }
    catch { setCopyProblem("Clipboard access was unavailable. Select and copy the value below."); }
  };
  /** Adds/removes a draft ID type and clears stale form-validation feedback. */
  const toggleType = (type: IdType) => {
    setEditedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
    setEditProblem(undefined);
  };
  /**
   * Validates the correction draft and emits a new manual-provenance candidate.
   * It requires at least one ID type; rejecting a candidate is intentionally a
   * separate action. Nothing is persisted here—the parent decides persistence.
   */
  const saveCorrection = () => {
    if (!editedTypes.length) {
      setEditProblem("Choose at least one corrected identifier type, or use Reject if none apply.");
      return;
    }
    const rationale = editNote.trim() || "Corrected by the user during review.";
    const corrected: Annotation = {
      ...annotation,
      entityClass: editedClass,
      source: "manual",
      possibleIdTypes: editedTypes.map((type) => ({
        type,
        confidence: 1,
        rationale,
        ...(type === "EQPCODE" ? { eqpPrefix: prefix } : {}),
      })),
    };
    onChange(corrected, editNote.trim() || undefined);
    setEditing(false);
  };

  return <aside className="panel" aria-label="Annotation details">
    <p className="eyebrow">Selected annotation</p>
    <h2>{annotation.text}</h2>
    <p className="entity-line"><span>{annotation.entityClass}</span><span aria-hidden="true">/</span><span>{annotation.source} suggestion</span></p>
    <div className="decision-row"><button className="button button--approve" type="button" onClick={() => onDecision("accepted")}>Accept suggestion</button><button className="button button--secondary" type="button" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel change" : "Change"}</button><button className="button button--quiet" type="button" onClick={() => onDecision("rejected")}>Reject</button></div>
    {editing && <section className="correction-editor" aria-label="Change annotation suggestion">
      <h3>Correct this suggestion</h3>
      <label>Entity class
        <select value={editedClass} onChange={(event) => setEditedClass(event.target.value)}>
          {ENTITY_CLASSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <fieldset><legend>Correct identifier types</legend><div className="correction-types">
        {ID_TYPES.map((type) => <label key={type}><input type="checkbox" checked={editedTypes.includes(type)} onChange={() => toggleType(type)} />{type.replace("_", " + ")}</label>)}
      </div></fieldset>
      {editedTypes.includes("EQPCODE") && <label>Correct equipment category
        <select value={prefix} onChange={(event) => setPrefix(event.target.value)}>
          {EQP_PREFIXES.map(([code, name]) => <option value={code} key={code}>{code} - {name}</option>)}
        </select>
      </label>}
      <label>Reason or supervisor feedback <span>(optional)</span>
        <textarea value={editNote} onChange={(event) => setEditNote(event.target.value)} rows={2} placeholder="Why is this correction appropriate?" />
      </label>
      {editProblem && <p className="correction-problem" role="alert">{editProblem}</p>}
      <button className="button button--approve" type="button" onClick={saveCorrection}>Save correction</button>
    </section>}
    <h3>Possible identifier types</h3>
    <div className="recommendations">
      {annotation.possibleIdTypes.map((recommendation) => {
        const generated = generatedIds?.[recommendation.type];
        return <section className="recommendation" key={recommendation.type}>
        <div className="recommendation__heading"><strong>{recommendation.type.replace("_", " + ")}</strong><span className="confidence">{percent(recommendation.confidence)} confidence</span></div>
        <p>{recommendation.rationale}</p>
        {recommendation.type === "EQPCODE" && <label className="prefix-control">Equipment category
          <select value={prefix} onChange={(event) => setPrefix(event.target.value)} aria-label="EQPCODE category prefix">
            {EQP_PREFIXES.map(([code, name]) => <option value={code} key={code}>{code} - {name}</option>)}
          </select>
        </label>}
        {generated ? <><div className="generated"><input aria-label={`Generated ${recommendation.type}`} readOnly value={generated.value} /><button className="button button--quiet" onClick={() => { void copy(recommendation.type); }} type="button">{copied === recommendation.type ? "Copied" : "Copy"}</button><button className="text-button" onClick={() => generate(recommendation)} type="button">Regenerate</button></div><label className="json-inclusion"><input type="checkbox" checked={generated.included} onChange={(event) => onInclusionChange(recommendation.type, event.target.checked)} />Include this ID in JSON</label></> : <button className="button button--secondary" type="button" onClick={() => generate(recommendation)} disabled={!onGenerate}>Generate ID</button>}
      </section>;
      })}
    </div>
    {copyProblem && <p className="copy-problem" role="status">{copyProblem}</p>}
  </aside>;
}
