import { useEffect, useState } from "react";
import type { GeneratedJsonFormat } from "../reports/generatedJson";

/** Presentation inputs controlled by the report-level application state. */
interface Props {
  includedCount: number;
  value: string;
  format: GeneratedJsonFormat;
  onFormatChange: (format: GeneratedJsonFormat) => void;
  onGenerate: () => void;
}

/**
 * Presents schema selection, explicit generation, and copy controls for the
 * synthetic-ID payload. The component copies exactly the visible string and
 * never changes annotations or generated values itself.
 */
export function GeneratedJsonPanel({ includedCount, value, format, onFormatChange, onGenerate }: Props) {
  /** Clipboard success/error state is reset whenever the rendered value changes. */
  const [copied, setCopied] = useState(false);
  const [copyProblem, setCopyProblem] = useState<string>();

  useEffect(() => { setCopied(false); setCopyProblem(undefined); }, [value]);

  /** Copies the exact generated payload, retaining JSON-within-JSON escapes. */
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyProblem(undefined);
    } catch {
      setCopyProblem("Clipboard access was unavailable. Select and copy the JSON below.");
    }
  };

  return <section className="json-export" aria-label="Generated identifier JSON">
    <div className="json-export__heading"><div><p className="eyebrow">Structured output</p><h3>Generated ID JSON</h3></div><span>{includedCount} included ID{includedCount === 1 ? "" : "s"}</span></div>
    <label className="json-format-control">Output format
      <select value={format} onChange={(event) => onFormatChange(event.target.value as GeneratedJsonFormat)}>
        <option value="legacy">Legacy grouped arrays</option>
        <option value="records">Entity records — escaped JSON within JSON</option>
      </select>
    </label>
    <p>{format === "legacy"
      ? "Produces SCONUM, BE, and EQP_CODE arrays. Missing values use the existing empty-string placeholder."
      : "Groups generated IDs by highlighted name and escapes the complete array for insertion inside another JSON string."}</p>
    <button className="button button--secondary" type="button" onClick={onGenerate}>Generate JSON</button>
    {value && <div className="json-export__output"><textarea aria-label="Generated JSON" readOnly value={value} rows={3} /><button className="button button--quiet" type="button" onClick={() => { void copy(); }}>{copied ? "Copied" : "Copy JSON"}</button></div>}
    {copyProblem && <p className="copy-problem" role="status">{copyProblem}</p>}
  </section>;
}
