import { useEffect, useMemo, useState } from "react";
import {
  serializeReportOutput,
  type GeneratedIdentifier,
  type ReportJsonFormat,
} from "../output/reportJson";

/** Data and callbacks supplied by the report-level application controller. */
interface Props {
  identifiers: readonly GeneratedIdentifier[];
  format: ReportJsonFormat;
  onFormatChange: (format: ReportJsonFormat) => void;
  onClear: () => void;
}
/**
 * Displays the integration payload produced from generated annotation IDs.
 * The component never invents identifiers: it receives only values explicitly
 * generated in AnnotationPanel and provides format selection, copy feedback,
 * and a way to discard those generated values without clearing the report.
 */
export function JsonOutputPanel({ identifiers, format, onFormatChange, onClear }: Props) {
  /** Clipboard status is local UI state and is reset when the payload changes. */
  const [copyStatus, setCopyStatus] = useState<"copied" | "error">();

  /** Recompute serialization only when the source values or selected schema change. */
  const output = useMemo(
    () => serializeReportOutput(identifiers, format),
    [identifiers, format],
  );

  /** A changed payload has not been copied yet, so discard stale success text. */
  useEffect(() => setCopyStatus(undefined), [output]);

  /** Copies the exact visible payload; no labels or whitespace are added. */
  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return <section className="json-output-card" aria-labelledby="json-output-heading">
    <div className="section-heading">
      <div>
        <p className="eyebrow">Integration output</p>
        <h2 id="json-output-heading">Generated identifier JSON</h2>
      </div>
      <span className="char-count">{identifiers.length} generated value{identifiers.length === 1 ? "" : "s"}</span>
    </div>

    <div className="json-output-controls">
      <label>Output format
        <select
          value={format}
          onChange={(event) => onFormatChange(event.target.value as ReportJsonFormat)}
        >
          <option value="legacy">Legacy grouped arrays</option>
          <option value="records">Entity records — escaped JSON within JSON</option>
        </select>
      </label>
      <p>{format === "legacy"
        ? "Matches the existing SCONUM, BE, and EQP_CODE arrays, using an empty-string placeholder until a value is generated."
        : "Groups values by highlighted name and escapes every JSON quote for insertion inside an outer JSON string."}</p>
    </div>

    <textarea
      className="json-output"
      aria-label="Generated JSON output"
      readOnly
      spellCheck="false"
      value={output}
      onFocus={(event) => event.currentTarget.select()}
    />

    <div className="json-output-actions">
      <button className="button button--primary" type="button" onClick={() => { void copyOutput(); }}>
        {copyStatus === "copied" ? "Copied output" : "Copy output"}
      </button>
      <button className="button button--quiet" type="button" disabled={!identifiers.length} onClick={onClear}>
        Clear generated values
      </button>
      {copyStatus === "error" && <p role="status">Clipboard access failed. Select the output field and copy it manually.</p>}
    </div>
  </section>;
}
