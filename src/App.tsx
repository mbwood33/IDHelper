import { useEffect, useMemo, useRef, useState } from "react";
import {
  isLocalAiSupported,
  LOCAL_AI_MODELS,
  LocalModelAnalyzer,
  LocalModelCancelledError,
  type LocalAiModelId,
  type LocalAiProgress,
} from "./analyzers/localModel";
import { mergeCandidates } from "./analyzers/merge";
import { analyzeWithRules } from "./analyzers/rules";
import { isEqpCodePrefix } from "./domain";
import { AnnotatedReport } from "./components/AnnotatedReport";
import { AnnotationPanel } from "./components/AnnotationPanel";
import { LocalAiProgressPanel } from "./components/LocalAiProgressPanel";
import { ManualAnnotationForm } from "./components/ManualAnnotationForm";
import { GeneratedJsonPanel } from "./components/GeneratedJsonPanel";
import type { AnalysisResult, Annotation, IdRecommendation } from "./components/types";
import { generateSyntheticId } from "./generators";
import {
  countIncludedGeneratedIds,
  serializeGeneratedIdJson,
  type GeneratedJsonFormat,
  type GeneratedIdentifiersByAnnotation,
} from "./reports/generatedJson";
import {
  createReviewedDecision,
  loadKnowledgeState,
  parseKnowledgeBundle,
  saveKnowledgeState,
  serializeKnowledgeBundle,
  type KnowledgeState,
} from "./storage";

/** Optional dependency-injection seams used by component tests and host integrations. */
export interface AppProps {
  /** Replaces the built-in rules analyzer when supplied. */
  analyze?: (report: string) => Promise<AnalysisResult> | AnalysisResult;
  /** Replaces the cryptographic synthetic-ID generator when supplied. */
  generateId?: (recommendation: IdRecommendation, eqpPrefix?: string) => string;
}

/** Public fixture used to demonstrate the main entity classes without network access. */
const sample = "On June 2, 2024, about 1649 local time, the emissions control barge STAX 1 was capturing emissions from the containership Erving at the Fenix Marine Services Container Terminal in the Port of Los Angeles, Los Angeles, California, when a ship-to-shore container crane struck the barge's capture and control articulated arm.";

/**
 * Coordinates report entry, analysis, review, persistence, generation, and
 * integration output. All report processing remains in browser memory; only
 * deliberate reviewer feedback is persisted to IndexedDB.
 */
export default function App({ analyze, generateId }: AppProps) {
  /** Exact source text entered by the user; analyzers never rewrite this value. */
  const [report, setReport] = useState("");
  /** Validated exact-span candidates currently rendered over the report. */
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  /** Candidate shown in the persistent annotation details panel. */
  const [selected, setSelected] = useState<Annotation>();
  /** Source selection being converted into a manual missed-ID annotation. */
  const [manualSelection, setManualSelection] = useState<{ start: number; end: number; text: string }>();
  /** User-added annotations retained across repeated analysis of unchanged text. */
  const [manualAnnotations, setManualAnnotations] = useState<Annotation[]>([]);
  /** Generated raw IDs keyed by annotation ID and identifier family. */
  const [generatedIds, setGeneratedIds] = useState<GeneratedIdentifiersByAnnotation>({});
  /** Most recently rendered JSON, cleared whenever its source state changes. */
  const [generatedJson, setGeneratedJson] = useState("");
  /** Selectable downstream schema for the generated JSON panel. */
  const [generatedJsonFormat, setGeneratedJsonFormat] = useState<GeneratedJsonFormat>("legacy");
  /** Accessible human-readable result/status announcement. */
  const [status, setStatus] = useState("Rules-only analyzer ready. No report text leaves this browser.");
  /** Prevents overlapping rules analyses. */
  const [busy, setBusy] = useState(false);
  /** Locks conflicting report actions while streamed model inference is active. */
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  /** High-level local-model lifecycle used to enable and label controls. */
  const [localAiState, setLocalAiState] = useState<"available" | "loading" | "ready" | "unavailable" | "error">(
    () => isLocalAiSupported() ? "available" : "unavailable",
  );
  /** Model chosen for the next load; it cannot change while an engine is live. */
  const [localAiModel, setLocalAiModel] = useState<LocalAiModelId>(LOCAL_AI_MODELS[1].id);
  /** Detailed worker activity shown in the live progress panel. */
  const [localAiProgress, setLocalAiProgress] = useState<LocalAiProgress>(() => ({
    stage: isLocalAiSupported() ? "checking" : "error",
    message: isLocalAiSupported()
      ? "Local AI is off. Select a model and enable it when needed."
      : "WebGPU is unavailable in this browser. Rules-only analysis still works.",
    elapsedMs: 0,
  }));
  /** Locally stored policy overrides and human-reviewed examples. */
  const [knowledge, setKnowledge] = useState<KnowledgeState>({ policyOverrides: [], reviewedDecisions: [] });
  /** Hidden file input used to start an explicit knowledge-bundle import. */
  const importInput = useRef<HTMLInputElement>(null);
  /** Textarea reference used to read the user's exact manual span selection. */
  const reportInput = useRef<HTMLTextAreaElement>(null);
  /** Long-lived worker-backed analyzer instance; refs avoid UI rerenders on mutation. */
  const localModel = useRef<LocalModelAnalyzer | null>(null);
  /** Derived candidate count for legend grammar and display. */
  const count = useMemo(() => annotations.length, [annotations]);
  const includedGeneratedCount = useMemo(
    () => countIncludedGeneratedIds(annotations, generatedIds),
    [annotations, generatedIds],
  );

  /** Loads saved feedback once and ignores late completion after unmount. */
  useEffect(() => {
    let active = true;
    void loadKnowledgeState()
      .then((saved) => { if (active) setKnowledge(saved); })
      .catch(() => { if (active) setStatus("Rules-only analyzer ready. Local feedback storage is unavailable in this browser."); });
    return () => { active = false; };
  }, []);

  /** Unloads GPU/model resources when the application unmounts. */
  useEffect(() => () => { void localModel.current?.dispose(); }, []);

  /** Downloads/initializes the selected model and completes a GPU warm-up. */
  async function enableLocalAi() {
    if (localAiState === "unavailable" || localAiState === "loading") return;
    setLocalAiState("loading");
    try {
      const analyzer = localModel.current ?? new LocalModelAnalyzer();
      localModel.current = analyzer;
      await analyzer.load(localAiModel, setLocalAiProgress);
      setLocalAiState("ready");
    } catch (error) {
      if (error instanceof LocalModelCancelledError) {
        setLocalAiState("available");
      } else {
        setLocalAiState("error");
      }
    }
  }

  /** Releases live model resources but deliberately retains browser cache files. */
  async function unloadLocalAi() {
    await localModel.current?.dispose();
    localModel.current = null;
    setLocalAiState(isLocalAiSupported() ? "available" : "unavailable");
    setLocalAiProgress({
      stage: "stopped",
      message: "Local model unloaded. Browser-cached model files were left in place.",
      elapsedMs: 0,
    });
  }

  /** Requests cooperative cancellation from the worker-backed model engine. */
  function stopLocalAi() {
    localModel.current?.interrupt();
    setLocalAiProgress((current) => ({ ...current, stage: "stopped", message: "Stop requested; waiting for the worker to finish the current GPU step..." }));
  }

  /** Returns only manual spans that still exactly match the current report. */
  function currentManualAnnotations(): Annotation[] {
    return manualAnnotations.filter((item) => report.slice(item.start, item.end) === item.text);
  }

  function startManualAnnotation() {
    const input = reportInput.current;
    if (!input) return;
    const rawStart = input.selectionStart;
    const rawEnd = input.selectionEnd;
    const rawText = report.slice(rawStart, rawEnd);
    const leading = rawText.match(/^\s*/)?.[0].length ?? 0;
    const trailing = rawText.match(/\s*$/)?.[0].length ?? 0;
    const start = rawStart + leading;
    const end = rawEnd - trailing;
    if (start >= end) {
      setManualSelection(undefined);
      setStatus("Select the exact missed words in the source report, then choose Add missed ID.");
      input.focus();
      return;
    }
    const text = report.slice(start, end);
    if (text.includes("_")) {
      setManualSelection(undefined);
      setStatus("Select the entity text itself, without a legacy underscore blank.");
      input.focus();
      return;
    }
    setManualSelection({ start, end, text });
    setStatus(`Specify the identifier type for “${text}”.`);
  }

  async function addManualAnnotation(annotation: Annotation) {
    setGeneratedJson("");
    setManualAnnotations((current) => [
      ...current.filter((item) => item.start !== annotation.start || item.end !== annotation.end),
      annotation,
    ]);
    setAnnotations((current) => [
      ...current.filter((item) => item.start !== annotation.start || item.end !== annotation.end),
      annotation,
    ].sort((a, b) => a.start - b.start || a.end - b.end));
    setSelected(annotation);
    setManualSelection(undefined);

    const reviewed = createReviewedDecision(report, annotation, "edited", {
      id: globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}-${annotation.id}`,
      reviewedAt: new Date().toISOString(),
      note: "Manually added after automated analysis missed this span.",
    });
    const next = { ...knowledge, reviewedDecisions: [...knowledge.reviewedDecisions, reviewed] };
    setKnowledge(next);
    try {
      await saveKnowledgeState(next);
      setStatus(`${annotation.text} added and saved locally. Generate a synthetic ID in the annotation panel.`);
    } catch {
      setStatus(`${annotation.text} added for this session. Generate a synthetic ID in the annotation panel.`);
    }
  }

  /** Runs deterministic local rules and merges valid user-added annotations. */
  async function runAnalysis() {
    if (!report.trim()) { setStatus("Paste a report before analyzing."); return; }
    setGeneratedJson("");
    setBusy(true); setSelected(undefined);
    try {
      if (analyze) {
        const result = await analyze(report);
        const combined = mergeCandidates([...result.annotations, ...currentManualAnnotations()]);
        setAnnotations(combined);
        setStatus(result.status ?? `${combined.length} candidate${combined.length === 1 ? "" : "s"} found.`);
        return;
      }

      const ruleCandidates = mergeCandidates([...analyzeWithRules(report), ...currentManualAnnotations()]);
      setAnnotations(ruleCandidates);
      setStatus(`${ruleCandidates.length} candidate${ruleCandidates.length === 1 ? "" : "s"} found using rules.`);
    } catch {
      setAnnotations([]);
      setStatus("Rules analysis could not run.");
    }
    finally { setBusy(false); }
  }

  /**
   * Shows immediate rule results, then incrementally merges exact validated
   * candidates streamed by the local model. Partial results survive failure.
   */
  async function runLocalAiAnalysis() {
    if (!report.trim() || localAiState !== "ready" || !localModel.current) return;
    const reportSnapshot = report;
    setGeneratedJson("");
    const ruleCandidates = mergeCandidates([...analyzeWithRules(reportSnapshot), ...currentManualAnnotations()]);
    setSelected(undefined);
    setAnnotations(ruleCandidates);
    setStatus(`${ruleCandidates.length} rule candidate${ruleCandidates.length === 1 ? "" : "s"} shown. Local AI is starting...`);
    setAiAnalyzing(true);
    try {
      const modelCandidates = await localModel.current.analyze(
        reportSnapshot,
        setLocalAiProgress,
        (candidate) => {
          setAnnotations((current) => mergeCandidates([...current, candidate]));
        },
        knowledge.reviewedDecisions,
      );
      const merged = mergeCandidates([...ruleCandidates, ...modelCandidates]);
      setAnnotations(merged);
      setStatus(`${merged.length} candidate${merged.length === 1 ? "" : "s"} found using rules and local AI.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local AI failed.";
      setStatus(`${message} Any rule or partial AI annotations remain available.`);
    } finally {
      setAiAnalyzing(false);
    }
  }

  /** Clears all report-scoped state but deliberately retains saved reviewer knowledge. */
  function clear() {
    setReport(""); setAnnotations([]); setManualAnnotations([]); setGeneratedIds({});
    setGeneratedJson(""); setSelected(undefined); setManualSelection(undefined);
    setStatus("Cleared. Paste a report to begin.");
  }
  /** Records an accept/reject outcome locally without changing report content. */
  async function decide(decision: "accepted" | "rejected") {
    if (!selected) return;
    const reviewed = createReviewedDecision(report, selected, decision, {
      id: globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}-${selected.id}`,
      reviewedAt: new Date().toISOString(),
    });
    const next = { ...knowledge, reviewedDecisions: [...knowledge.reviewedDecisions, reviewed] };
    setKnowledge(next);
    try {
      await saveKnowledgeState(next);
      setStatus(`${selected.text} marked ${decision} and saved locally.`);
    } catch {
      setStatus(`${selected.text} marked ${decision} for this session. Local storage was unavailable.`);
    }
  }
  /** Applies and persists an explicit human correction to the selected candidate. */
  async function changeAnnotation(corrected: Annotation, note?: string) {
    setGeneratedJson("");
    const reviewed = createReviewedDecision(report, corrected, "edited", {
      id: globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}-${corrected.id}`,
      reviewedAt: new Date().toISOString(),
      note,
    });
    const next = { ...knowledge, reviewedDecisions: [...knowledge.reviewedDecisions, reviewed] };
    setKnowledge(next);
    setAnnotations((current) => current.map((item) => item.id === corrected.id ? corrected : item));
    setManualAnnotations((current) => current.map((item) => item.id === corrected.id ? corrected : item));
    setSelected(corrected);
    try {
      await saveKnowledgeState(next);
      setStatus(`${corrected.text} corrected and saved locally for future local-AI reviews.`);
    } catch {
      setStatus(`${corrected.text} corrected for this session. Local storage was unavailable.`);
    }
  }
  /** Returns a raw synthetic ID; EQPCODE receives only an approved prefix. */
  function createId(recommendation: IdRecommendation, eqpPrefix?: string) {
    if (generateId) return generateId(recommendation, eqpPrefix);
    return generateSyntheticId(
      recommendation.type,
      recommendation.type === "EQPCODE" && isEqpCodePrefix(eqpPrefix) ? { eqpPrefix } : {},
    );
  }
  /**
   * Upserts a generated value for the selected annotation and preserves its
   * previous inclusion choice when the user regenerates the same ID family.
   */
  function recordGeneratedId(type: IdRecommendation["type"], value: string) {
    if (!selected) return;
    setGeneratedIds((current) => ({
      ...current,
      [selected.id]: {
        ...current[selected.id],
        [type]: {
          value,
          included: current[selected.id]?.[type]?.included ?? true,
        },
      },
    }));
    setGeneratedJson("");
  }
  /** Changes one generated value's membership in the next serialized payload. */
  function setGeneratedIdIncluded(type: IdRecommendation["type"], included: boolean) {
    if (!selected) return;
    setGeneratedIds((current) => {
      const existing = current[selected.id]?.[type];
      if (!existing) return current;
      return {
        ...current,
        [selected.id]: {
          ...current[selected.id],
          [type]: { ...existing, included },
        },
      };
    });
    setGeneratedJson("");
  }
  /**
   * Replaces the source report and invalidates every span-dependent result.
   * Generated values and manual annotations must never carry across reports
   * because their offsets and names belong to the prior text.
   */
  function changeReport(value: string) {
    setReport(value);
    setAnnotations([]);
    setManualAnnotations([]);
    setManualSelection(undefined);
    setSelected(undefined);
    setGeneratedIds({});
    setGeneratedJson("");
    setStatus(value ? "Text changed; analyze again to refresh suggestions." : "Paste a report before analyzing.");
  }
  /** Downloads the versioned reviewer-knowledge bundle as readable JSON. */
  function exportKnowledge() {
    const blob = new Blob([serializeKnowledgeBundle(knowledge)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "idhelper-knowledge.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Knowledge bundle exported. It contains only the feedback you chose to save locally.");
  }
  /** Validates, previews, confirms, and atomically replaces local knowledge. */
  async function importKnowledge(file?: File) {
    if (!file) return;
    const parsed = parseKnowledgeBundle(await file.text());
    if (!parsed.ok) { setStatus(`Import not applied: ${parsed.errors.join(" ")}`); return; }
    const { preview } = parsed;
    const confirmed = window.confirm(
      `Import ${preview.policyOverrideCount} policy override(s) and ${preview.reviewedDecisionCount} reviewed decision(s)? This replaces local knowledge.`,
    );
    if (!confirmed) { setStatus("Knowledge import cancelled."); return; }
    const next = {
      policyOverrides: preview.bundle.policyOverrides,
      reviewedDecisions: preview.bundle.reviewedDecisions,
    };
    try {
      await saveKnowledgeState(next);
      setKnowledge(next);
      setStatus("Knowledge bundle imported and saved locally.");
    } catch { setStatus("Knowledge bundle was valid but could not be saved in this browser."); }
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand__mark" aria-hidden="true">ID</span><div><h1>IDHelper</h1><p>Local-first report annotation assistant</p></div></div><div className="status-pills"><span className="status-pill status-pill--ready">● Rules ready</span><span className={`status-pill ${localAiState === "ready" ? "status-pill--ready" : ""}`}>{localAiState === "ready" ? "● Local AI ready" : localAiState === "loading" ? "Local AI loading" : localAiState === "unavailable" ? "WebGPU unavailable" : "Local AI optional"}</span></div></header>
    <section className="intro"><div><p className="eyebrow">One report at a time</p><h2>Find plausible identifiers. Keep the source unchanged.</h2><p>Suggestions are review aids, not a MIDB lookup. Highlighted phrases open a panel where you can generate and copy a raw synthetic ID.</p></div><div className="intro-actions"><div className="intro-links"><button className="text-button" type="button" onClick={() => { setReport(sample); setAnnotations([]); setManualAnnotations([]); setGeneratedIds({}); setGeneratedJson(""); setSelected(undefined); }}>Load example report</button><button className="text-button" type="button" onClick={exportKnowledge}>Export knowledge</button><button className="text-button" type="button" onClick={() => importInput.current?.click()}>Import knowledge</button></div><label className="ai-control">Local model<select value={localAiModel} disabled={localAiState === "loading" || localAiState === "ready"} onChange={(event) => setLocalAiModel(event.target.value as LocalAiModelId)}>{LOCAL_AI_MODELS.map((model) => <option value={model.id} key={model.id}>{model.label} — {model.requirement}</option>)}</select></label><div className="ai-buttons">{localAiState === "ready" ? <button className="text-button" type="button" disabled={aiAnalyzing} onClick={() => { void unloadLocalAi(); }}>Unload local AI</button> : <button className="text-button" type="button" disabled={localAiState === "loading" || localAiState === "unavailable"} onClick={() => { void enableLocalAi(); }}>{localAiState === "error" ? "Retry local AI" : "Enable local AI"}</button>}{localAiState === "loading" && <button className="text-button" type="button" onClick={stopLocalAi}>Cancel loading</button>}</div><LocalAiProgressPanel progress={localAiProgress} /><input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { void importKnowledge(event.target.files?.[0]); event.target.value = ""; }} /></div></section>
    <section className="workspace" aria-label="Report workspace"><div className="editor-card"><div className="section-heading"><div><p className="eyebrow">Source report</p><h2>Paste report text</h2></div><span className="char-count">{report.length.toLocaleString()} characters</span></div><label className="sr-only" htmlFor="report">Report text</label><textarea ref={reportInput} id="report" value={report} disabled={aiAnalyzing} onChange={(event) => changeReport(event.target.value)} placeholder="Paste one report here. The original text is never rewritten." spellCheck="true" /><div className="actions"><button className="button button--primary" type="button" disabled={busy || aiAnalyzing || !report.trim()} onClick={runAnalysis}>{busy ? "Analyzing..." : "Analyze with rules"}</button>{localAiState === "ready" && <button className="button button--secondary" type="button" disabled={busy || aiAnalyzing || !report.trim()} onClick={() => { void runLocalAiAnalysis(); }}>{aiAnalyzing ? "Local AI analyzing..." : "Analyze with local AI"}</button>}<button className="button button--secondary" type="button" disabled={busy || aiAnalyzing || !report} onClick={startManualAnnotation}>Add missed ID</button>{aiAnalyzing && <button className="button button--quiet" type="button" onClick={stopLocalAi}>Stop local AI</button>}<button className="button button--quiet" type="button" disabled={busy || aiAnalyzing || (!report && !annotations.length)} onClick={clear}>Clear</button><p className="local-note">Select missed text and add it manually when rules do not find it.</p></div><p className="analysis-status" role="status">{status}</p>{manualSelection && <ManualAnnotationForm report={report} selection={manualSelection} onAdd={(annotation) => { void addManualAnnotation(annotation); }} onCancel={() => setManualSelection(undefined)} />}</div>
      <div className="legend" aria-label="Annotation legend"><span><i className="legend__swatch legend__swatch--vessel" />Vessel / platform</span><span><i className="legend__swatch legend__swatch--facility" />Facility / site</span><span><i className="legend__swatch legend__swatch--equipment" />Equipment / signal</span><span>{count} candidate{count === 1 ? "" : "s"}</span></div>
    </section>
    <section className="review-grid"><article className="report-card"><div className="section-heading"><div><p className="eyebrow">Read-only result</p><h2>Annotated report</h2></div>{annotations.length > 0 && <span className="keyboard-hint">Tab to highlights, then Enter</span>}</div>{report ? annotations.length ? <AnnotatedReport report={report} annotations={annotations} selectedId={selected?.id} onSelect={setSelected} /> : <div className="empty-report"><strong>No annotations yet</strong><p>Analyze this report to see supported candidate phrases here.</p></div> : <div className="empty-report"><strong>Your report will appear here</strong><p>Paste a report above, then select Analyze report.</p></div>}<GeneratedJsonPanel includedCount={includedGeneratedCount} value={generatedJson} format={generatedJsonFormat} onFormatChange={(format) => { setGeneratedJsonFormat(format); setGeneratedJson(""); }} onGenerate={() => setGeneratedJson(serializeGeneratedIdJson(annotations, generatedIds, generatedJsonFormat))} /></article><AnnotationPanel annotation={selected} onDecision={decide} onChange={changeAnnotation} onGenerate={createId} generatedIds={selected ? generatedIds[selected.id] : undefined} onGenerated={recordGeneratedId} onInclusionChange={setGeneratedIdIncluded} /></section>
    <footer>Rules-only analysis is always available. Local AI runs in a browser worker and never uploads report text.</footer>
  </main>;
}
