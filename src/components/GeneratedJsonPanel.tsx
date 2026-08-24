import { useEffect, useState } from "react";

interface Props {
  includedCount: number;
  value: string;
  onGenerate: () => void;
}

export function GeneratedJsonPanel({ includedCount, value, onGenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyProblem, setCopyProblem] = useState<string>();

  useEffect(() => { setCopied(false); setCopyProblem(undefined); }, [value]);

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
    <p>Generate JSON from the synthetic IDs whose <strong>Include in JSON</strong> boxes are selected. BE+OSUFFIX values are grouped under <code>BE</code>.</p>
    <button className="button button--secondary" type="button" disabled={includedCount === 0} onClick={onGenerate}>Generate JSON</button>
    {value && <div className="json-export__output"><textarea aria-label="Generated JSON" readOnly value={value} rows={3} /><button className="button button--quiet" type="button" onClick={() => { void copy(); }}>{copied ? "Copied" : "Copy JSON"}</button></div>}
    {copyProblem && <p className="copy-problem" role="status">{copyProblem}</p>}
  </section>;
}
