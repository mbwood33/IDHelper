import { useEffect, useState } from "react";
import { EQP_PREFIXES, type Annotation, type IdRecommendation, type IdType } from "./types";

interface Props {
  annotation?: Annotation;
  onDecision: (decision: "accepted" | "rejected") => void;
  onChange: (annotation: Annotation, note?: string) => void;
  onGenerate?: (recommendation: IdRecommendation, eqpPrefix?: string) => string | undefined;
}

function percent(value: number) { return `${Math.round(value * 100)}%`; }

const ID_TYPES: IdType[] = ["SCONUM", "BE", "BE_OSUFFIX", "SK", "EQPCODE", "CENOT", "ELNOT"];
const ENTITY_CLASSES = [
  ["named-vessel", "Named vessel / maritime platform"],
  ["facility", "Facility / installation / site"],
  ["equipment", "Equipment type / model"],
  ["communications-signal", "Communications signal / emitter"],
  ["electronic-signal", "Electronic signal / emitter"],
  ["other-indexed-entity", "Other possibly indexed entity"],
] as const;

export function AnnotationPanel({ annotation, onDecision, onChange, onGenerate }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string>();
  const [prefix, setPrefix] = useState("G");
  const [copyProblem, setCopyProblem] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [editedClass, setEditedClass] = useState("other-indexed-entity");
  const [editedTypes, setEditedTypes] = useState<IdType[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editProblem, setEditProblem] = useState<string>();

  useEffect(() => {
    const suggested = annotation?.possibleIdTypes.find((item) => item.type === "EQPCODE")?.eqpPrefix;
    if (suggested && EQP_PREFIXES.some(([code]) => code === suggested)) setPrefix(suggested);
    setValues({});
    setCopied(undefined);
    setCopyProblem(undefined);
    setEditing(false);
    setEditedClass(annotation?.entityClass ?? "other-indexed-entity");
    setEditedTypes(annotation?.possibleIdTypes.map((item) => item.type) ?? []);
    setEditNote("");
    setEditProblem(undefined);
  }, [annotation?.id]);

  if (!annotation) return <aside className="panel panel--empty" aria-label="Annotation details"><p className="eyebrow">Annotation details</p><h2>Select a highlight</h2><p>Choose a highlighted phrase in the analyzed report to review its possible IDs and create a value.</p></aside>;

  const generate = (recommendation: IdRecommendation) => {
    const value = onGenerate?.(recommendation, recommendation.type === "EQPCODE" ? prefix : undefined);
    if (value) setValues((current) => ({ ...current, [recommendation.type]: value }));
  };
  const copy = async (type: string) => {
    const value = values[type];
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(type); setCopyProblem(undefined); }
    catch { setCopyProblem("Clipboard access was unavailable. Select and copy the value below."); }
  };
  const toggleType = (type: IdType) => {
    setEditedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
    setEditProblem(undefined);
  };
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
      {annotation.possibleIdTypes.map((recommendation) => <section className="recommendation" key={recommendation.type}>
        <div className="recommendation__heading"><strong>{recommendation.type.replace("_", " + ")}</strong><span className="confidence">{percent(recommendation.confidence)} confidence</span></div>
        <p>{recommendation.rationale}</p>
        {recommendation.type === "EQPCODE" && <label className="prefix-control">Equipment category
          <select value={prefix} onChange={(event) => setPrefix(event.target.value)} aria-label="EQPCODE category prefix">
            {EQP_PREFIXES.map(([code, name]) => <option value={code} key={code}>{code} - {name}</option>)}
          </select>
        </label>}
        {values[recommendation.type] ? <div className="generated"><input aria-label={`Generated ${recommendation.type}`} readOnly value={values[recommendation.type]} /><button className="button button--quiet" onClick={() => copy(recommendation.type)} type="button">{copied === recommendation.type ? "Copied" : "Copy"}</button><button className="text-button" onClick={() => generate(recommendation)} type="button">Regenerate</button></div> : <button className="button button--secondary" type="button" onClick={() => generate(recommendation)} disabled={!onGenerate}>Generate ID</button>}
      </section>)}
    </div>
    {copyProblem && <p className="copy-problem" role="status">{copyProblem}</p>}
  </aside>;
}
