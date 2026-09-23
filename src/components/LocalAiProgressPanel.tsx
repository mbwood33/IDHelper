import type { LocalAiProgress } from "../analyzers/localModel";

/** Inputs supplied by the local-model adapter while a worker is active. */
interface Props {
  /** Latest immutable progress snapshot; it contains no report text. */
  progress: LocalAiProgress;
}

/**
 * Converts an elapsed millisecond count to a compact screen-readable label.
 *
 * @param ms Non-negative or potentially stale elapsed duration in milliseconds.
 * @returns Seconds below one minute, otherwise whole minutes and remaining seconds.
 */
function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Announces local AI download/inference progress without blocking interaction.
 * The polite live region avoids interrupting screen-reader users for every
 * progress event, while `aria-atomic` makes each update understandable alone.
 *
 * @param progress Worker/model status, optional fractional progress, diagnostics,
 * and aggregate counters. The component has no side effects or network access.
 * @returns An accessible status panel; indeterminate progress omits the bar.
 */
export function LocalAiProgressPanel({ progress }: Props) {
  /** Clamp untrusted progress before using it in text and a CSS width property. */
  const percent = progress.progress === undefined
    ? undefined
    : Math.max(0, Math.min(100, Math.round(progress.progress * 100)));

  return <aside className={`ai-progress ai-progress--${progress.stage}`} aria-live="polite" aria-atomic="true">
    <div className="ai-progress__heading">
      <strong>Local AI activity</strong>
      <span>{progress.stage}</span>
    </div>
    <p>{progress.message}</p>
    {percent !== undefined && <div className="ai-progress__bar" aria-label={`${percent}% complete`}>
      <span style={{ width: `${percent}%` }} />
    </div>}
    <dl>
      <div><dt>Elapsed</dt><dd>{formatElapsed(progress.elapsedMs)}</dd></div>
      {percent !== undefined && <div><dt>Load</dt><dd>{percent}%</dd></div>}
      {progress.charactersReceived !== undefined && <div><dt>Output</dt><dd>{progress.charactersReceived} chars</dd></div>}
      {progress.candidatesFound !== undefined && <div><dt>Accepted</dt><dd>{progress.candidatesFound}</dd></div>}
    </dl>
    {progress.diagnostics && <p className="ai-progress__diagnostics">{progress.diagnostics}</p>}
  </aside>;
}
