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

export interface AppProps {
  analyze?: (report: string) => Promise<AnalysisResult> | AnalysisResult;
  generateId?: (recommendation: IdRecommendation, eqpPrefix?: string) => string;
}

const sample = "On June 2, 2024, about 1649 local time, the emissions control barge STAX 1 was capturing emissions from the containership Erving at the Fenix Marine Services Container Terminal in the Port of Los Angeles, Los Angeles, California, when a ship-to-shore container crane struck the barge's capture and control articulated arm.";

export default function App({ analyze, generateId }: AppProps) {
  const [report, setReport] = useState("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selected, setSelected] = useState<Annotation>();
  const [manualSelection, setManualSelection] = useState<{ start: number; end: number; text: string }>();
  const [manualAnnotations, setManualAnnotations] = useState<Annotation[]>([]);
  const [generatedIds, setGeneratedIds] = useState<GeneratedIdentifiersByAnnotation>({});
  const [generatedJson, setGeneratedJson] = useState("");
  const [status, setStatus] = useState("Rules-only analyzer ready. No report text leaves this browser.");
  const [busy, setBusy] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [localAiState, setLocalAiState] = useState<"available" | "loading" | "ready" | "unavailable" | "error">(
    () => isLocalAiSupported() ? "available" : "unavailable",
  );
  const [localAiModel, setLocalAiModel] = useState<LocalAiModelId>(LOCAL_AI_MODELS[1].id);
  const [localAiProgress, setLocalAiProgress] = useState<LocalAiProgress>(() => ({
    stage: isLocalAiSupported() ? "checking" : "error",
    message: isLocalAiSupported()
      ? "Local AI is off. Select a model and enable it when needed."
      : "WebGPU is unavailable in this browser. Rules-only analysis still works.",
    elapsedMs: 0,
  }));
  const [knowledge, setKnowledge] = useState<KnowledgeState>({ policyOverrides: [], reviewedDecisions: [] });
  const importInput = useRef<HTMLInputElement>(null);
  const reportInput = useRef<HTMLTextAreaElement>(null);
  const localModel = useRef<LocalModelAnalyzer | null>(null);
  const count = useMemo(() => annotations.length, [annotations]);
  const includedGeneratedCount = useMemo(
    () => countIncludedGeneratedIds(annotations, generatedIds),
    [annotations, generatedIds],
  );

  useEffect(() => {
    let active = true;
    void loadKnowledgeState()
      .then((saved) => { if (active) setKnowledge(saved); })
      .catch(() => { if (active) setStatus("Rules-only analyzer ready. Local feedback storage is unavailable in this browser."); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => { void localModel.current?.dispose(); }, []);

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

  function stopLocalAi() {
    localModel.current?.interrupt();
    setLocalAiProgress((current) => ({ ...current, stage: "stopped", message: "Stop requested; waiting for the worker to finish the current GPU step..." }));
  }

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

  function clear() { setReport(""); setAnnotations([]); setManualAnnotations([]); setGeneratedIds({}); setGeneratedJson(""); setSelected(undefined); setManualSelection(undefined); setStatus("Cleared. Paste a report to begin."); }
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
  function createId(recommendation: IdRecommendation, eqpPrefix?: string) {
    if (generateId) return generateId(recommendation, eqpPrefix);
    return generateSyntheticId(
      recommendation.type,
      recommendation.type === "EQPCODE" && isEqpCodePrefix(eqpPrefix) ? { eqpPrefix } : {},
    );
  }
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
    <section className="intro"><div><p className="eyebrow">One report at a time</p><h2>Find plausible identifiers. Keep the source unchanged.</h2><p>Suggestions are review aids, not a MIDB lookup. Highlighted phrases open a panel where you can generate and copy a raw synthetic ID.</p></div><div className="intro-actions"><div className="intro-links"><button className="text-button" type="button" onClick={() => setReport(sample)}>Load example report</button><button className="text-button" type="button" onClick={exportKnowledge}>Export knowledge</button><button className="text-button" type="button" onClick={() => importInput.current?.click()}>Import knowledge</button></div><label className="ai-control">Local model<select value={localAiModel} disabled={localAiState === "loading" || localAiState === "ready"} onChange={(event) => setLocalAiModel(event.target.value as LocalAiModelId)}>{LOCAL_AI_MODELS.map((model) => <option value={model.id} key={model.id}>{model.label} — {model.requirement}</option>)}</select></label><div className="ai-buttons">{localAiState === "ready" ? <button className="text-button" type="button" disabled={aiAnalyzing} onClick={() => { void unloadLocalAi(); }}>Unload local AI</button> : <button className="text-button" type="button" disabled={localAiState === "loading" || localAiState === "unavailable"} onClick={() => { void enableLocalAi(); }}>{localAiState === "error" ? "Retry local AI" : "Enable local AI"}</button>}{localAiState === "loading" && <button className="text-button" type="button" onClick={stopLocalAi}>Cancel loading</button>}</div><LocalAiProgressPanel progress={localAiProgress} /><input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { void importKnowledge(event.target.files?.[0]); event.target.value = ""; }} /></div></section>
    <section className="workspace" aria-label="Report workspace"><div className="editor-card"><div className="section-heading"><div><p className="eyebrow">Source report</p><h2>Paste report text</h2></div><span className="char-count">{report.length.toLocaleString()} characters</span></div><label className="sr-only" htmlFor="report">Report text</label><textarea ref={reportInput} id="report" value={report} disabled={aiAnalyzing} onChange={(event) => { setReport(event.target.value); setManualSelection(undefined); setGeneratedIds({}); setGeneratedJson(""); }} placeholder="Paste one report here. The original text is never rewritten." spellCheck="true" /><div className="actions"><button className="button button--primary" type="button" disabled={busy || aiAnalyzing || !report.trim()} onClick={runAnalysis}>{busy ? "Analyzing..." : "Analyze with rules"}</button>{localAiState === "ready" && <button className="button button--secondary" type="button" disabled={busy || aiAnalyzing || !report.trim()} onClick={() => { void runLocalAiAnalysis(); }}>{aiAnalyzing ? "Local AI analyzing..." : "Analyze with local AI"}</button>}<button className="button button--secondary" type="button" disabled={busy || aiAnalyzing || !report} onClick={startManualAnnotation}>Add missed ID</button>{aiAnalyzing && <button className="button button--quiet" type="button" onClick={stopLocalAi}>Stop local AI</button>}<button className="button button--quiet" type="button" disabled={busy || aiAnalyzing || (!report && !annotations.length)} onClick={clear}>Clear</button><p className="local-note">Select missed text and add it manually when rules do not find it.</p></div><p className="analysis-status" role="status">{status}</p>{manualSelection && <ManualAnnotationForm report={report} selection={manualSelection} onAdd={(annotation) => { void addManualAnnotation(annotation); }} onCancel={() => setManualSelection(undefined)} />}</div>
      <div className="legend" aria-label="Annotation legend"><span><i className="legend__swatch legend__swatch--vessel" />Vessel / platform</span><span><i className="legend__swatch legend__swatch--facility" />Facility / site</span><span><i className="legend__swatch legend__swatch--equipment" />Equipment / signal</span><span>{count} candidate{count === 1 ? "" : "s"}</span></div>
    </section>
    <section className="review-grid"><article className="report-card"><div className="section-heading"><div><p className="eyebrow">Read-only result</p><h2>Annotated report</h2></div>{annotations.length > 0 && <span className="keyboard-hint">Tab to highlights, then Enter</span>}</div>{report ? annotations.length ? <AnnotatedReport report={report} annotations={annotations} selectedId={selected?.id} onSelect={setSelected} /> : <div className="empty-report"><strong>No annotations yet</strong><p>Analyze this report to see supported candidate phrases here.</p></div> : <div className="empty-report"><strong>Your report will appear here</strong><p>Paste a report above, then select Analyze report.</p></div>}<GeneratedJsonPanel includedCount={includedGeneratedCount} value={generatedJson} onGenerate={() => setGeneratedJson(serializeGeneratedIdJson(annotations, generatedIds))} /></article><AnnotationPanel annotation={selected} onDecision={decide} onChange={changeAnnotation} onGenerate={createId} generatedIds={selected ? generatedIds[selected.id] : undefined} onGenerated={recordGeneratedId} onInclusionChange={setGeneratedIdIncluded} /></section>
    <footer>Rules-only analysis is always available. Local AI runs in a browser worker and never uploads report text.</footer>
  </main>;
}
