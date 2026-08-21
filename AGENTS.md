# IDHelper Agent Guide

## Purpose

IDHelper is a browser-first assistant for reviewing a single pasted report and identifying words or phrases that could be associated with one or more intelligence-domain identifier types. It highlights candidate text, explains the possible identifier types, and generates format-conforming synthetic identifiers for the user to copy.

The tool is a suggestion and review aid, not an authoritative MIDB lookup service. It does not retrieve real identifiers, validate generated values against an allocation system, or guarantee that a supervisor will accept an annotation. The user is developing the annotation policy through use and supervisor feedback, so recommendations and mappings must remain editable and transparent.

The project directory was empty when this guide was created. Unless the repository gains an established stack before implementation begins, use the architecture proposed below.

## Primary user workflow

1. The user pastes one report into a text area.
2. The user selects **Analyze**.
3. The application analyzes a candid copy of the report and highlights candidate entity spans.
4. The report itself remains unchanged. Do not insert an identifier into the report text merely because a candidate was found.
5. Selecting a highlight opens a persistent annotation panel. Do not rely on hover-only tooltips.
6. The panel shows:
   - the exact highlighted text;
   - its proposed entity class;
   - one or more possible ID types;
   - confidence and a short explanation;
   - controls to accept, reject, or change the suggestion;
   - controls to generate, regenerate, and copy a synthetic ID.
7. The copy control copies only the raw generated identifier. For example, it copies `A48217`, not `SCONUM: A48217`, not `[A48217]`, and not a synthetic-data warning.
8. The user can preserve corrections locally and export/import the accumulated rules and feedback as JSON.

Example: in `containership Erving`, the application may highlight `Erving`. Selecting it can recommend SCONUM and SK. Generating and copying the SCONUM copies only a value such as `A48217`.

## Scope

### Initial scope

- One pasted report at a time.
- Inline, exact-span highlighting.
- Multiple possible ID types per entity.
- Closely adjacent or overlapping candidates where necessary.
- A persistent details/annotation panel.
- Deterministic synthetic ID generation.
- An analyzer that works without an LLM.
- An optional, locally executed browser model for improved semantic suggestions.
- Preservation of user corrections in browser storage.
- Import/export of rules and corrections.
- Installable/offline-capable PWA build.
- A restricted-environment Lite build that does not require a model.

### Explicitly out of initial scope

- CSV import and bulk processing.
- Use of the CSV `Category` column.
- Cloud inference or uploading report contents.
- Real MIDB, MEPED, CED, ONI, or other system integration.
- Looking up, assigning, reserving, or collision-checking real identifiers.
- Automatically modifying the pasted report with accepted IDs.
- Treating legacy underscores as ground truth.
- Training or fine-tuning a model before enough reviewed examples exist.

## Identifier domain

The supported identifier types are:

- **SCONUM**: Ship Control Number, including numbers associated with maritime platforms.
- **BE Number**: Basic Encyclopedia number used for facilities, installations, and related entities. It may optionally be accompanied by an O-suffix (OSUFFIX).
- **SK**: Surrogate Key used in MIDB.
- **EQPCODE**: Equipment code maintained by DIA and used to identify equipment categories or types in systems such as MIDB, MEPED, and CED.
- **SIGNOT**: Signal notation, divided into CENOT for communications emitters/signals and ELNOT for electronic/noncommunications emitters/signals.

### Provisional entity-to-ID mappings

These mappings are starting suggestions, not authoritative doctrine. Keep them configurable and allow the user to override every recommendation.

| Entity class | Initial possible IDs |
| --- | --- |
| Named vessel or maritime platform | SCONUM, SK |
| Facility, installation, terminal, base, airfield, or similar site | BE Number, BE Number + OSUFFIX, SK |
| Equipment class, model, or type | EQPCODE, possibly SK |
| Specific communications signal or emitter | CENOT, possibly SK |
| Specific noncommunications electronic signal or emitter | ELNOT, possibly SK |
| Unclear but plausibly indexed MIDB entity | SK at low confidence |

Avoid treating generic words as specific entities. For example, the word `emissions` alone is not sufficient evidence for a CENOT or ELNOT. The report should refer to a particular signal, emitter, radar, communications system, or equivalent identifiable object.

Named instances and equipment types can occupy different spans. In `containership Erving`, `containership` may describe an equipment/platform category while `Erving` is the named individual vessel. The UI and data model must not assume that one entire noun phrase always receives one annotation.

### EQPCODE prefixes

Generate EQPCODE as one approved prefix followed by four digits. The analyzer should recommend a prefix category and confidence, while the user can override it before generation.

| Prefix | Category |
| --- | --- |
| A | Aircraft - Fixed Wing |
| B | Aircraft - Rotary Wing |
| C | Naval Ships - Combatant Ship Category |
| D | Naval Ships - Combatant Craft Category |
| E | Naval Ships - Auxiliary Ship Category |
| F | Naval Ships - Support Craft Category |
| G | Merchant/Fishing/Research/Special Purpose and Other Non-Military Ships |
| H | Optics |
| J | Engines & Propulsion Systems |
| K | Space Objects Equipment & Launch Vehicles |
| L | Associated/Miscellaneous Equipment |
| M | Antitank Weapons |
| N | Armored Vehicles |
| O | Mortars |
| P | Tanks |
| Q | General Purpose Vehicles |
| R | Special Purpose Vehicles |
| S | Engineering Equipment |
| T | Air Defense Weapons |
| U | Field Artillery/Surface Bombardment Weapons/Torpedo Tubes |
| V | Surface-to-Surface Missile Launchers |
| W | Small Arms |
| X | Radars/Electronic Warfare Equipment & Other Remote Detection Devices |
| Y | Communications and Automatic Data Processing (ADP) Equipment |
| Z | Missiles/Ammunition |
| 9 | File Administrative Entries |

Do not generate an `I` prefix or any prefix not listed above.

## Synthetic identifier formats

`X` means any uppercase A-Z letter and `0` means any digit 0-9 unless a more specific restriction is listed. Leading zeroes are allowed for now.

### SCONUM

- Pattern: `X00000`
- Example: `A48217`

### BE Number

- Pattern: `0000XX0000`
- Pattern: `0000-00000`
- Examples: `4821QP7390`, `4821-73904`

### OSUFFIX

- Pattern: `XX000`
- When present, append it after the BE Number with one space.
- Examples: `4821QP7390 RT204`, `4821-73904 RT204`

### SK

- Exactly 14 numeric digits.
- Conceptually, five server digits followed by nine sequence digits.
- Examples supplied by the user include `00000000001000`, `79000000000003`, and `00001234567890`.

### EQPCODE

- One approved category prefix followed by four digits.
- Examples: `G4821`, `X7390`, `90004`.
- The earlier tentative `XX0000` form is not approved and must not be generated.

### CENOT

- `XX000` is the most common form.
- Also allow `X000X`, `X0000`, and `00000`.

### ELNOT

- `X000X` is the most common form.
- Also allow `X0000` and `00000`.

### Generator requirements

- Generate IDs with ordinary deterministic code, never with an LLM.
- Use `crypto.getRandomValues()` rather than `Math.random()` where available.
- Allow regeneration.
- Copy only the identifier value.
- Do not add labels, brackets, whitespace, warnings, or punctuation to the copied value.
- Values are synthetic and need not be checked against real identifier registries.
- Unit-test every allowed shape and explicitly test prohibited shapes.

## Legacy underscore handling

Some source reports may contain variable-length underscore blanks inserted by coworkers. They are unreliable hints.

1. Preserve the original report exactly.
2. Detect every run matching `_+` and record its original start/end offsets.
3. Create an analysis copy by replacing each underscore with a space, preserving string length and offsets.
4. Run the primary analysis without telling the model that the underscore locations are expected answers.
5. Compare independent recommendations with the saved blank locations afterward.
6. Optionally classify each legacy blank as aligned, possibly misplaced, unsupported, or missing a nearby candidate.

Never silently delete or rewrite underscores in the user's displayed source.

## Analysis approach

Use a hybrid pipeline:

```text
original report
  -> underscore-aware normalization with offset mapping
  -> deterministic rules and dictionaries
  -> optional local semantic analyzer
  -> configurable entity-to-ID policy
  -> exact-span and schema validation
  -> merged/ranked candidates
  -> human review
```

### Rules analyzer

The application must remain useful when no model is downloaded or WebGPU is unavailable. The rules analyzer should use context terms and configurable dictionaries to find likely names and noun phrases. Initial context families include:

- vessels: vessel, ship, containership, barge, destroyer, frigate, craft, carrier;
- facilities: terminal, installation, facility, base, airfield, port, site, plant;
- signals and emitters: radar, emitter, signal, frequency, transmission, communications;
- equipment: named models or specific equipment noun phrases plus the EQPCODE category table.

Rules should prefer precision over highlighting every generic noun, but the product goal is to surface plausible candidates for review rather than make final authoritative decisions.

### Optional local model

- Run locally in the browser; do not send report text to a cloud API.
- Start with WebLLM behind an adapter interface and execute inference in a Web Worker.
- Provide a small low-resource model option and a better-quality model option when hardware supports it.
- Detect WebGPU capability and fail gracefully to rules-only mode.
- Make model acquisition an explicit user action with download size/progress and a clear cached/offline status.
- Keep model-specific code isolated so Transformers.js, Chrome built-in AI, or another approved local runtime can be evaluated later.
- Require structured JSON output and validate it before use.
- A model suggestion is untrusted data. It must not directly mutate the report or application configuration.

Suggested analyzer output contract:

```ts
type IdType = "SCONUM" | "BE" | "BE_OSUFFIX" | "SK" | "EQPCODE" | "CENOT" | "ELNOT";

interface CandidateAnnotation {
  id: string;
  start: number;
  end: number;
  text: string;
  entityClass: string;
  possibleIdTypes: Array<{
    type: IdType;
    confidence: number;
    rationale: string;
    eqpPrefix?: string;
  }>;
  source: "rule" | "model" | "merged" | "manual";
}
```

Every returned candidate must satisfy all of the following before rendering:

- integer, in-bounds offsets;
- `start < end`;
- `report.slice(start, end) === text` after applying the documented offset mapping;
- known ID types only;
- finite confidence in the range 0-1;
- no report rewriting or model-invented substring.

Merge duplicate rule/model candidates while preserving source provenance. Define an explicit policy for overlapping spans instead of dropping them accidentally.

## Feedback and evolving policy

The user is not starting with a complete authoritative rulebook or a shareable gold dataset. Design around that constraint.

- Every recommendation can be accepted, rejected, or edited.
- Save decisions locally as reviewed examples.
- Distinguish application defaults from user-created rules.
- Allow rollback/reset of learned settings.
- Export rules, settings, and reviewed examples as a versioned JSON document.
- Import must validate schema/version and preview changes before applying them.
- Do not automatically train on coworker underscore locations.
- Do not silently turn one supervisor correction into a broad rule. Let the user deliberately promote repeated feedback into a rule.
- Explanations should state the textual evidence and mapping used, not claim hidden certainty.

## Recommended architecture

Unless superseded by existing repository decisions:

- React + TypeScript + Vite.
- Static, client-only application with no required backend.
- PWA manifest and service worker for offline application assets.
- Analysis behind a typed adapter so rules and model analyzers are independently testable.
- Web Worker for local model inference and other expensive processing.
- IndexedDB for settings, feedback, and model/cache metadata.
- Pure generator and validator modules with no UI dependencies.
- Accessible rendered spans/buttons; keyboard navigation and visible focus states are required.
- Persistent side panel on wide screens and a modal/bottom sheet with equivalent behavior on narrow screens.

Avoid adding a rich-text editor unless required. A plain paste input plus a separate read-only annotated rendering is safer for stable character offsets.

Suggested conceptual modules:

```text
src/
  domain/       identifier formats, prefix taxonomy, mappings, schemas
  analyzers/    rules, local-model adapter, candidate merge/validation
  generators/   pure synthetic ID generators
  reports/      normalization, underscore tracking, offset mapping
  storage/      IndexedDB and import/export
  workers/      model worker protocol
  components/   input, annotated report, side panel, settings
```

Do not create these directories mechanically if the chosen framework or existing repository has already established another coherent organization.

## Deployment targets

### Full build

- A host-agnostic static PWA.
- Initial public deployment target: GitHub Pages.
- It must also be deployable to Netlify, Cloudflare Pages, or an approved internal static HTTPS host.
- No report content is transmitted to the host after static assets are loaded.
- Avoid runtime CDN dependencies for application code. Bundle dependencies in the build.
- Model weights may initially come from an explicit external download, but support configurable/same-origin model locations for restricted networks.
- After required assets are cached, offline use should be possible. Display whether the selected model and application version are actually cached; do not merely claim offline readiness.

### Lite build

- Provide a no-model restricted-environment build.
- Prefer a self-contained HTML artifact if practical.
- It must include report input, rule suggestions, manual annotations, generators, and copy behavior.
- It need not be an installable PWA when opened with `file://`.
- Keep behavior and persisted data formats compatible with the full build where browser restrictions permit.

### Privacy and network behavior

The reports are public, unclassified material randomly obtained from the internet, but the intended architecture is still local-first.

- No analytics, telemetry, cloud logging, or cloud inference by default.
- No API keys in client code.
- Make every network dependency auditable.
- Report text must not appear in URLs, query strings, error-reporting services, or console logs.
- Use a restrictive Content Security Policy when supported by the chosen host.

## Accessibility and interaction requirements

- A highlight must be selectable with mouse and keyboard.
- Do not make hover the only way to discover details.
- Do not communicate ID type or confidence by color alone.
- Preserve whitespace and punctuation in the rendered report.
- Provide a clear legend for highlight styles.
- Copy controls must confirm success without changing clipboard content.
- If clipboard permission fails, show the raw value in a selectable field and explain the failure.
- Analysis must be cancellable and must not freeze the main UI.
- Expose rules-only operation while a model is downloading or unavailable.

## Testing and acceptance criteria

At minimum, add tests for:

- every identifier format and every EQPCODE prefix;
- exact output length and character classes;
- copying raw identifiers without decoration;
- underscore normalization and original-offset preservation;
- repeated substrings and exact span matching;
- overlapping and adjacent candidates;
- invalid/out-of-bounds model output rejection;
- candidate merge behavior;
- local persistence and versioned import/export validation;
- analyzer fallback when WebGPU/model initialization fails;
- no network call during rules-only report analysis;
- keyboard selection of highlights;
- report text remaining unchanged after analysis and ID generation.

Use the supplied public example as an early behavior fixture:

> On June 2, 2024, about 1649 local time, the emissions control barge STAX 1 was capturing emissions from the containership Erving at the Fenix Marine Services Container Terminal in the Port of Los Angeles, Los Angeles, California, when a ship-to-shore container crane struck the barge's capture and control articulated arm, causing it to collapse, and sections of it fell onto the barge, onto the Erving, and into the water.

Plausible candidates to test, without asserting them as absolute truth:

- `STAX 1`: named vessel/barge -> SCONUM and possibly SK;
- `Erving`: named vessel -> SCONUM and possibly SK;
- `Fenix Marine Services Container Terminal`: facility -> BE/BE+OSUFFIX and possibly SK;
- `ship-to-shore container crane`: equipment type -> EQPCODE with an uncertain category requiring review;
- generic `emissions`: should not automatically become SIGNOT.

## Concurrent agent coordination

Multiple agents may work in this repository concurrently.

- Assume you are not alone in the codebase.
- Before editing, inspect current files and `git status` if a repository exists.
- Do not revert or overwrite another agent's changes.
- Keep ownership boundaries explicit in task assignments.
- Prefer independent work areas such as domain/generators, report normalization, analyzers, persistence, UI, and deployment/tests.
- Avoid broad formatting or dependency rewrites while other agents are active.
- If a shared type or contract must change, communicate the change and update consumers deliberately.
- Make small, reviewable patches and run focused tests for the owned area.
- Preserve user edits and unrelated dirty-worktree changes.
- Do not make product-policy assumptions silently. Record new assumptions in documentation or surface them for review.

Recommended parallel work boundaries after the initial scaffold exists:

1. Domain types, mappings, generators, and validation.
2. Report normalization, underscore tracking, offset validation, and rule analysis.
3. Annotated-report UI, side panel, accessibility, and clipboard behavior.
4. PWA/offline packaging, persistence/import-export, and local-model adapter.

Coordinate shared contracts before parallel implementation to minimize merge conflicts.

## Product principles

- Suggestions must be inspectable and overridable.
- Prefer exact evidence over confident-sounding prose.
- Preserve the source report.
- Keep raw clipboard output exact.
- Maintain a useful no-model path.
- Treat local-model output as untrusted structured input.
- Let reviewed user feedback improve the tool without pretending uncertain policy is settled.
