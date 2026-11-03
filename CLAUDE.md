# CLAUDE.md

Context for Claude Code (and humans) working in this repo. Part 1 is how the project works today. Part 2 is the session history: how it got here and why.

---

## Part 1: Project guide

### What this is

A **Vehicle Selection Form**: drill-down **Make → Model → Badge** dropdowns, quick-select buttons, and a required plain-text service logbook upload. A valid submit is a normal browser `multipart/form-data` POST of the vehicle fields plus the logbook file. The backend parses it with **Multer** and renders a plain-text result page at `/upload`.

Guiding principle: **function over polish**, close to a real-world system without over-engineering. Use native React hooks only, with no state library and no UI framework.

### Layout (npm workspaces monorepo)

```
shared/      @vehicle/shared, imported as @vehicle/shared/{config,constants,templates,types,utils,vehicleData.json}
  config.ts          DEFAULT_MAX_LOGBOOK_BYTES, parseMaxSizeBytes(env), formatBytes()
  constants.ts       UPLOAD_PATH, LOGBOOK_FIELD, ALLOWED_EXTENSIONS/MIME_TYPES, LOGBOOK_ACCEPT, has*() checks, messages
  templates.ts       formatResultPage(): the /upload text layout (also used by tests)
  types.ts           VehicleCatalog, VehicleSelection, VehicleSubmission (selection + decoded logbookText)
  utils.ts           formatMake()
  vehicleData.json   catalog: lowercase make key → model → badge[]
backend/     Express 5 + TypeScript + Multer 2, run with tsx (no build step)
  src/index.ts                   loads .env (dotenv, first import), app.listen(PORT)
  src/config.ts                  ONLY reader of process.env: PORT, MAX_LOGBOOK_BYTES, UPLOAD_LIMITS (Multer limits)
  src/app.ts                     nosniff header, POST /upload → parseLogbookUpload → uploadVehicle, errorHandler
  src/middleware/upload.ts       Multer: memoryStorage, UPLOAD_LIMITS, type fileFilter, .single(LOGBOOK_FIELD); maps errors to UploadError
  src/controllers/submission.ts  uploadVehicle: req.body + req.file → validateSubmission → text/plain page or 400
  src/middleware/errorHandler.ts UploadError → its status/message; anything else 500 (all text/plain)
  src/utils/validation.ts        validateSubmission(): pure; fields, file presence/type/size, UTF-8 text, catalog
  test/                          mirrors src/ (Vitest + Supertest .field()/.attach()), plus test/shared/ for @vehicle/shared
frontend/    Vite + React 19 + TypeScript
  src/config.ts                  ONLY reader of import.meta.env: UPLOAD_URL, MAX_LOGBOOK_BYTES, QUICK_SELECTS
  src/utils/quickSelects.ts      parseQuickSelects()/resolveQuickSelect(): env "make-model-badge" → catalog values
  src/App.tsx                    <h1>Drill Down Form</h1> + <VehicleForm />
  src/components/VehicleForm.tsx      state, drill-down, quick select, checkLogbookFile(), multipart form
  src/components/DropdownSelector.tsx presentation-only labelled <select> (hideLabel option)
  src/styles.css                 layout only: 200px stacked controls, visually-hidden class
  test/                          mirrors src/ (Vitest + Testing Library + jsdom), setup.ts
```

### Commands (from the repo root)

```bash
npm install
npm run dev          # backend :3000 + frontend :5173 (concurrently)
npm test             # both suites
npm run typecheck    # tsc --noEmit in both apps
npm run build        # frontend production build
```

Run a single workspace with `-w`: `npm test -w @vehicle/frontend`, `npm run dev -w @vehicle/backend`.

### Environment

| File            | Variable        | Default  | Notes |
| --------------- | --------------- | -------- | ----- |
| `backend/.env`  | `PORT`          | `3000`   | Shell variables win over `.env`. If `PORT` is exported in the shell, the backend will use it. |
| `backend/.env`  | `MAX_LOGBOOK_BYTES` | `1048576` | Becomes Multer's `limits.fileSize`. Parsed by the shared `parseMaxSizeBytes()`, and invalid values fall back to 1 MB. |
| `frontend/.env` | `VITE_MAX_LOGBOOK_BYTES` | `1048576` | Must equal the backend's `MAX_LOGBOOK_BYTES`. |
| `frontend/.env` | `VITE_QUICK_SELECTS` | *(none)* | JSON array of `"make-model-badge"`, wrapped in single quotes. Matched against the catalog by prefix, ignoring case. Bad entries are skipped with a warning. |
| `frontend/.env` | `VITE_API_URL`  | *(empty)* | Backend base URL the form posts to. Empty means `/upload` on the form's own origin. |

`.env` files are gitignored, and `.env.example` files are committed. `.claude/launch.json` has separate `frontend` and `backend` preview entries. A single combined entry broke, because the preview runner sets `PORT` for whatever it starts.

### Behaviour rules (all covered by tests)

- **Drill-down:** at first only Make is shown. Model appears once a Make is chosen, and Badge once a Model is chosen.
- **Clearing:** changing the Make clears the Model, Badge and logbook. Changing the Model clears the Badge and logbook. A quick select also clears a picked file.
- **Options are derived, not stored:** the Model and Badge lists are recalculated from the catalog on every render.
- **Quick select ("Select a Vehicle"):** the buttons come from `VITE_QUICK_SELECTS`, defaulting to Tesla Model 3 Performance and BMW 130d xDrive 26d. They can also be passed as `VehicleForm`'s `quickSelects` prop. Each button sets all three values at once, and the section is hidden when the list is empty. The Vitest config sets `VITE_QUICK_SELECTS` itself, so the tests don't depend on `.env`.
- **Logbook (client side):** `checkLogbookFile()` uses only the browser's `File` metadata (name, type, size) and never reads the content. It runs when a file is picked, so a bad file is cleared immediately with a popup, and again on Submit, which blocks the POST.
  - **Required:** no file, or a 0-byte file, gives `Please upload logbook`.
  - **Type:** the extension must be in `ALLOWED_EXTENSIONS`. The MIME type must be in `ALLOWED_MIME_TYPES` or unknown (`''` or `application/octet-stream`). Otherwise the message is `Logbook should be txt file`.
  - **Size:** a file over `MAX_LOGBOOK_BYTES` gives `Logbook must be 1 MB or smaller.`, with the size taken from the limit.
- **Errors:** every client-side error is a popup through `showError()`, which calls `window.alert()`, and never appears inline.
- **Submit:** `<form method="post" encType="multipart/form-data" action={UPLOAD_URL}>`. The dropdowns have no `name`. Hidden inputs post `make`, `model` and `badge`, and the file input posts the file as `name={LOGBOOK_FIELD}` (`logbook`).
- **Backend `/upload`:**
  - **Parsing:** Multer stores the file in memory with hard limits on every part of the request: `fileSize` = `MAX_LOGBOOK_BYTES`, `files` 1, `fields` 3, `fieldSize` 256 B, `fieldNameSize` 32, `parts` 4, `headerPairs` 20. Its `fileFilter` rejects a bad type before buffering the file.
  - **Validation:** `validateSubmission` re-checks the type and size, decodes the file as UTF-8 (rejecting invalid UTF-8 or NUL bytes as "not txt"), treats a whitespace-only file as missing, then checks the vehicle against the catalog.
  - **Success:** `text/plain; charset=utf-8` with `nosniff`. Exact 200 body: `Make: <make>\nModel: <model>\nBadge: <badge>\n\nLogbook:\n\n<text>\n`. The make is printed as the raw lowercase key, e.g. `bmw`.
- **Backend errors (plain text):**
  - **400** with the validation message.
  - **400** `Logbook should be txt file` from the `fileFilter`.
  - **413** with the size message when Multer's `LIMIT_FILE_SIZE` trips.
  - **400** `Malformed upload.` for any other Multer limit (an extra file, the wrong file field, extra or oversized fields, too many parts) or an unparseable body.
  - **Non-multipart bodies are never parsed.**
- **Layout matches the reference screenshot:** the dropdown labels are visually hidden but still read by screen readers.

### Conventions and constraints

- **Uploads go through Multer** (2.x) on the `/upload` route only, with memory storage and the strict `UPLOAD_LIMITS` in `backend/src/config.ts`. When you add a form field, raise `fields` and `parts` to match.
- **No Redux or other state libraries**, and no CSS framework. Keep styling minimal.
- **No hardcoded limits, paths, field names, file types, messages or templates in app code.** These come from `@vehicle/shared` or from env through each app's `config.ts`. Tests import the same definitions, and `backend/test/shared/shared.test.ts` pins the literal wording and layout.
- **Tests sit in `test/` folders that mirror `src/`**, not next to the source files.
- **jsdom can't navigate,** so the frontend submit tests listen for `submit` on `document`, which runs after React's root handler. They check `defaultPrevented` and `FormData`. jsdom's `FormData` can't see files set by user-event, so the chosen file is asserted on the input instead.
- **The user often edits files and runs their own dev servers on :3000 and :5173 between turns.** Check before starting new ones, and treat changes on disk as intentional.

---

## Part 2: Session history

The session ran from 2026-10-31 to 2026-11-04. Each entry below is a request and what was done.

1. **Directory structure.** Proposed a monorepo with `/frontend` (Vite + React + TS) and `/backend` (Express). The user replaced it with their own layout, which adds `shared/` (types and `vehicleData.json`). Created it with placeholder files and added `shared/package.json` so both apps could import `@vehicle/shared`.

2. **First implementation.** Wrote `shared/types.ts`, the Express server with one route (then `POST /api/submit`, JSON in and out), `VehicleForm` (dropdown state, logbook upload, quick-selects) and `App` (switching between the form and a result view). The Streamable demo video had no readable text, so the work followed the written brief and the user's `vehicleData.json`.

3. **Wiring and verification.** Added the package files, tsconfigs, Vite config, `index.html` and `main.tsx`, then installed everything. Tested the API with curl and the UI in the browser.
   - **Bug found:** the preview runner's `PORT=5173` made the backend take the frontend's port. Worked around it by switching to `API_PORT`, which was later reverted, see 5.
   - Moved `formatMake` into `shared/utils.ts`.

4. **README and tests.** Split the backend into `app.ts` (the Express app) and `index.ts` (startup) so Supertest can test it without a port. Added Vitest suites for both apps and checked that a broken rule makes its test fail.

5. **Env vars and component split.** Moved to `backend/.env` with `PORT=3000` (loaded with dotenv) and `frontend/.env` with `VITE_API_URL`. Extracted `DropdownSelector.tsx`, a presentation-only component, and `SubmissionResult.tsx`. Split `launch.json` into separate frontend and backend entries because of the `PORT` clash.

6. **Tests moved** into `backend/test/` and `frontend/test/` folders that mirror `src/`.

7. **Backend modularised** into `controllers/submission.ts`, `middleware/errorHandler.ts` and `utils/validation.ts`, with `app.ts` reduced to wiring.

8. **Drill-down UI** from the reference screenshot: Model and Badge appear only once the level above has a value. The quick-select list became vertical and its border was removed.

9. **Exact screenshot match and 1 MB limit.**
   - **Screen:** title "Drill Down Form", hidden dropdown labels, "Upload Logbook:" label, and only the Tesla and BMW quick-select buttons.
   - **1 MB limit:** a single logbook size limit, shared by the frontend and backend and measured in bytes.

10. **Required logbook and popups.**
    - The logbook is required on both the form and the server ("Please upload logbook").
    - Only `.txt` files are accepted ("Logbook should be txt file").
    - All errors are shown with `window.alert()`.

11. **Result page at `/upload`, rendered by the backend.** The user chose this over a frontend route.
    - **Backend:** `POST /upload` accepts the `multipart/form-data` upload, parsed by Multer with memory storage and strict limits, and replies with plain text and `nosniff`. `/api/submit` and `cors` were removed.
    - **Frontend:** a native multipart POST form replaced `fetch`. The logbook's presence, type and size are checked when a file is picked and on Submit. `SubmissionResult` was deleted.
    - **Check:** verified end to end in the browser, landing on `localhost:3000/upload`.

12. **This file** was written to record the session.

13. **Env-driven limits and shared domain constants.**
    - **Size limits from env:** `MAX_LOGBOOK_BYTES` and `VITE_MAX_LOGBOOK_BYTES` are parsed by the shared `parseMaxSizeBytes()`. The parser is stricter than first proposed: `1mb`, `0` and negative values fall back to the default.
    - **Shared definitions:** the upload path, file types, messages and result template moved into `shared/config.ts`, `constants.ts` and `templates.ts`. Each app reads env in one place, its own `config.ts`.

14. **Quick selects from env.** `VITE_QUICK_SELECTS` is a JSON array of `make-model-badge` strings, resolved against the catalog. `VehicleForm` takes a `quickSelects` prop that defaults to it.

### Final state

- **Tests:** backend 70 and frontend 69 pass, and `npm run typecheck` is clean.
- **Git:** the repo is initialised but has no commits yet.
- **`npm audit --omit=dev`:** 0 vulnerabilities, including Multer 2.5.0.
- **Full `npm audit`:** dev tooling only.
  - `tinypool`, used by Vitest 3, has critical advisories. The fix is a major Vitest upgrade.
  - `minimatch`, via the user's root dev dependency `eslint`, has moderate advisories.
  - Neither is part of the running app.

### Open ideas, not done

- Upgrading Vitest to clear the dev-only `tinypool` advisories. It's a breaking major version.
- A production build for the backend (bundle with esbuild, or emit with tsc) instead of running `tsx`.
- Replacing `window.alert()` with a custom modal. The change would be confined to `showError()`.
- Server-side errors appear as a plain-text page, not a popup. That covers tampered requests and a logbook that is only whitespace, which the browser can't detect without reading the file. It was an accepted trade-off of the backend-rendered `/upload`.
