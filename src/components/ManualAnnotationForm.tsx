import { useState } from "react";
import { EQP_PREFIXES, type Annotation, type IdType } from "./types";
import { createManualAnnotation } from "../analyzers/manual";

interface Selection {
  start: number;
  end: number;
  text: string;
}

interface Props {
  report: string;
  selection: Selection;
  onAdd: (annotation: Annotation) => void;
  onCancel: () => void;
}

const ID_TYPES: IdType[] = ["SCONUM", "BE", "BE_OSUFFIX", "SK", "EQPCODE", "CENOT", "ELNOT"];
const ENTITY_CLASSES = [
  ["vessel", "Named vessel / maritime platform"],
  ["facility", "Facility / installation / site"],
  ["equipment", "Equipment type / model"],
  ["communications-signal", "Communications signal / emitter"],
  ["electronic-signal", "Electronic signal / emitter"],
  ["other-indexed-entity", "Other possibly indexed entity"],
] as const;

export function ManualAnnotationForm({ report, selection, onAdd, onCancel }: Props) {
  const [entityClass, setEntityClass] = useState("other-indexed-entity");
  const [idTypes, setIdTypes] = useState<IdType[]>([]);
  const [eqpPrefix, setEqpPrefix] = useState("G");
  const [problem, setProblem] = useState<string>();

  const toggleType = (type: IdType) => {
    setIdTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
    setProblem(undefined);
  };

  const add = () => {
    if (!idTypes.length) {
      setProblem("Choose at least one identifier type.");
      return;
    }
    const annotation = createManualAnnotation(report, {
      id: globalThis.crypto?.randomUUID?.() ?? `manual-${Date.now()}-${selection.start}`,
      start: selection.start,
      end: selection.end,
      entityClass,
      idTypes,
      eqpPrefix,
    });
    if (!annotation) {
      setProblem("This selection could not be added. Select exact report text without underscore blanks.");
      return;
    }
    onAdd(annotation);
  };

  return <section className="manual-editor" aria-label="Add missed identifier annotation">
    <div className="manual-editor__heading"><div><p className="eyebrow">Manual annotation</p><h3>Add a missed ID location</h3></div><button className="text-button" type="button" onClick={onCancel}>Cancel</button></div>
    <p className="manual-selection"><span>Selected text</span><strong>{selection.text}</strong></p>
    <div className="manual-editor__grid"><label>Entity class
      <select value={entityClass} onChange={(event) => setEntityClass(event.target.value)}>
        {ENTITY_CLASSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label><fieldset><legend>Identifier type(s)</legend><div className="correction-types">
      {ID_TYPES.map((type) => <label key={type}><input type="checkbox" checked={idTypes.includes(type)} onChange={() => toggleType(type)} />{type.replace("_", " + ")}</label>)}
    </div></fieldset></div>
    {idTypes.includes("EQPCODE") && <label className="manual-prefix">Equipment category
      <select value={eqpPrefix} onChange={(event) => setEqpPrefix(event.target.value)}>
        {EQP_PREFIXES.map(([code, name]) => <option value={code} key={code}>{code} - {name}</option>)}
      </select>
    </label>}
    {problem && <p className="correction-problem" role="alert">{problem}</p>}
    <button className="button button--approve" type="button" onClick={add}>Add annotation</button>
  </section>;
}
