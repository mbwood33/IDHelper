# IDHelper

IDHelper is a local-first browser application for reviewing one pasted report at a time. It highlights text that may be associated with SCONUM, BE/OSUFFIX, SK, EQPCODE, CENOT, or ELNOT identifiers, then generates a copyable synthetic identifier that matches the selected format.

Reports are analyzed in the browser using deterministic rules and do not need a network request.

## Optional local AI

The full app can run an opt-in WebLLM model in a browser worker through WebGPU. Model files are downloaded only after **Enable local AI** is selected and are cached by the browser. Report text is not sent to a cloud inference service.

Model loading now includes a one-token GPU warm-up test. During loading and analysis, the **Local AI activity** panel shows the current stage, elapsed time, download percentage, received output, accepted annotations, and available performance diagnostics. Local generation emits newline-delimited candidates; each exact-text candidate is validated and added to the report as soon as its line arrives.

The ordinary **Analyze with rules** action never waits for the model. **Analyze with local AI** first displays rule candidates, then adds model candidates incrementally. A missing first token or excessive total runtime stops automatically while preserving partial results. The 360M model is useful for quick compatibility tests, the 1B model is the default, and the 3B model is slower but may provide better context.

Selected annotations can be accepted, rejected, or changed. **Change** records the corrected entity class, corrected ID types, optional EQPCODE prefix, and optional reviewer explanation. The latest eight explicit corrections are supplied as compact examples to later local-AI requests. This is in-context guidance rather than model training: the base model weights are never silently modified, and exported knowledge remains readable JSON.

## Run locally

Requirements: Node.js 22 or newer and npm.

```powershell
npm install
npm run dev
```

Open the local URL Vite prints. To create the static production build:

```powershell
npm run build
```

The generated `dist` folder can be deployed to GitHub Pages, Netlify, Cloudflare Pages, or an approved internal static HTTPS host.

## Locked-down/offline fallback

Open [IDHelper-Lite.html](IDHelper-Lite.html) directly in a modern browser for a self-contained, rules-only version. It uses no external dependencies, model downloads, or network requests, making it suitable for `file://` use on a restricted computer. The Lite edition has the core paste, highlight, review, raw-ID copy, and EQPCODE-prefix features but does not include saved feedback/import-export or a future local-model option.

## Deploy to GitHub Pages

The included GitHub Actions workflow builds and publishes the application when changes are pushed to `main`.

1. Create a GitHub repository and push this project.
2. In the repository settings, set **Pages** to deploy from **GitHub Actions**.
3. Push to `main` or run the workflow manually from the Actions tab.

GitHub Pages receives only the static application files. IDHelper does not send pasted report text to the host.

## Product behavior

- Selecting a highlighted phrase such as `Erving` shows the possible ID types.
- Generating and copying a value copies only the identifier, such as `A48217`.
- Generated values are synthetic, format-conforming placeholders.
- The pasted report is never rewritten by analysis or ID generation.
- Runs of underscores are preserved in the source and treated as unreliable legacy hints.

Read [AGENTS.md](AGENTS.md) for the project requirements, identifier formats, analysis policy, architecture, and coordination rules.
