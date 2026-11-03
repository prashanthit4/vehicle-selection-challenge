# CLAUDE.md

Context for Claude Code (and humans) working in this repo. Part 1 is how the project works today. Part 2 is the session history: how it got here and why.

---

## Part 1: Project guide

### What this is

A **Vehicle Selection Form**: drill-down **Make → Model → Badge** dropdowns, quick-select buttons, and a required plain-text service logbook upload. A valid submit is a normal browser form POST to the backend. The backend renders a plain-text result page at `/upload`.

Guiding principle: **function over polish**, close to a real-world system without over-engineering. Use native React hooks only, with no state library and no UI framework.

### Layout (npm workspaces monorepo)

```
shared/      @vehicle/shared, imported as @vehicle/shared/{types,utils,vehicleData.json}
  types.ts           VehicleCatalog, VehicleSelection, VehicleSubmission
  utils.ts           formatMake(), MAX_LOGBOOK_BYTES (1 MB)
  vehicleData.json   catalog: lowercase make key → model → badge[]
backend/     Express 5 + TypeScript, run with tsx (no build step)
  src/index.ts                 loads .env (dotenv, first import), app.listen(PORT || 3000)
  src/app.ts                   nosniff header, express.urlencoded, POST /upload, errorHandler
  src/controllers/submission.ts  uploadVehicle: CRLF→LF, validate, text/plain result or 400
  src/middleware/errorHandler.ts 413 / 400 / 500 as text/plain
  src/utils/validation.ts      validateSubmission(): pure checks against the shared catalog
  test/                        mirrors src/ (Vitest + Supertest)
frontend/    Vite + React 19 + TypeScript
  src/App.tsx                  <h1>Drill Down Form</h1> + <VehicleForm />
  src/components/VehicleForm.tsx      state, drill-down, quick select, FileReader, submit checks
  src/components/DropdownSelector.tsx presentation-only labelled <select> (hideLabel option)
  src/styles.css               layout only: 200px stacked controls, visually-hidden class
  test/                        mirrors src/ (Vitest + Testing Library + jsdom), setup.ts
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
| `backend/.env`  | `MAX_BODY_SIZE` | `4mb`    | Must stay well above the 1 MB logbook limit, because URL-encoding inflates the text up to about 3x. |
| `frontend/.env` | `VITE_API_URL`  | *(empty)* | Backend base URL the form posts to. Empty means `/upload` on the form's own origin. |

`.env` files are gitignored, and `.env.example` files are committed. `.claude/launch.json` has separate `frontend` and `backend` preview entries. A single combined entry broke, because the preview runner sets `PORT` for whatever it starts.

### Behaviour rules (all covered by tests)

- **Drill-down:** at first only Make is shown. Model appears once a Make is chosen, and Badge once a Model is chosen.
- **Clearing:** changing the Make clears the Model, Badge and logbook. Changing the Model clears the Badge and logbook.
- **Options are derived, not stored:** the Model and Badge lists are recalculated from the catalog on every render.
- **Quick select ("Select a Vehicle"):** a vertical list of Tesla Model 3 Performance and BMW 130d xDrive 26d. Each button sets all three values at once.
- **Logbook:** required, `.txt` only (checked by file extension, not MIME type), at most 1 MB. It is read with `FileReader`, and Submit stays disabled until the read finishes.
- **Errors:** every client-side error is a popup through `showError()`, which calls `window.alert()`, and never appears inline. The exact messages are:
  - `Please upload logbook`
  - `Logbook should be txt file`
  - `Logbook must be 1 MB or smaller.`
  - `Could not read the logbook file.`
- **Submit:** `<form method="post" action={VITE_API_URL + '/upload'}>`. The visible controls have no `name`. Hidden fields post `make`, `model`, `badge`, and a hidden `<textarea name="logbookText">`. The file itself is never posted.
- **Backend `/upload`:** `text/plain; charset=utf-8` with `nosniff`. Exact 200 body:
  `Make: <make>\nModel: <model>\nBadge: <badge>\n\nLogbook:\n\n<text>\n`. The make is printed as the raw lowercase key, e.g. `bmw`.
- **Backend errors:** 400 with the plain-text error message, and 413 `Payload too large.`
- **Layout matches the reference screenshot:** the dropdown labels are visually hidden but still read by screen readers.

### Conventions and constraints

- **No multer or multipart parsing.** The logbook travels as text. This was an explicit requirement.
- **No Redux or other state libraries**, and no CSS framework. Keep styling minimal.
- **Shared contracts live in `shared/`.** If you change a limit or a type, change it there, so the frontend and backend can't drift apart.
- **Tests sit in `test/` folders that mirror `src/`**, not next to the source files.
- **jsdom can't navigate,** so the frontend submit tests listen for `submit` on `document`, which runs after React's root handler. They check `defaultPrevented` and `FormData`.
- **The user often edits files and runs their own dev servers on :3000 and :5173 between turns.** Check before starting new ones, and treat changes on disk as intentional.

---

## Part 2: Session history

The session ran from 2026-10-31 to 2026-11-04. Each entry below is a request and what was done.

1. **Directory structure.** Proposed a monorepo with `/frontend` (Vite + React + TS) and `/backend` (Express). The user replaced it with their own layout, which adds `shared/` (types and `vehicleData.json`). Created it with placeholder files and added `shared/package.json` so both apps could import `@vehicle/shared`.

2. **First implementation.** Wrote `shared/types.ts`, the Express server with one route (then `POST /api/submit`, JSON in and out), `VehicleForm` (dropdown state, `FileReader`, quick-selects) and `App` (switching between the form and a result view). The Streamable demo video had no readable text, so the work followed the written brief and the user's `vehicleData.json`.

3. **Wiring and verification.** Added the package files, tsconfigs, Vite config, `index.html` and `main.tsx`, then installed everything. Tested the API with curl and the UI in the browser.
   - **Bug found:** the preview runner's `PORT=5173` made the backend take the frontend's port. Worked around it by switching to `API_PORT`, which was later reverted, see 5.
   - Moved `formatMake` into `shared/utils.ts`.

4. **README and tests.** Split the backend into `app.ts` (the Express app) and `index.ts` (startup) so Supertest can test it without a port. Added Vitest suites for both apps and checked that a broken rule makes its test fail.

5. **Env vars and component split.** Moved to `backend/.env` with `PORT=3000` (loaded with dotenv) and `frontend/.env` with `VITE_API_URL`. Extracted `DropdownSelector.tsx`, a presentation-only component, and `SubmissionResult.tsx`. Split `launch.json` into separate frontend and backend entries because of the `PORT` clash.

6. **Tests moved** into `backend/test/` and `frontend/test/` folders that mirror `src/`.

7. **Backend modularised** into `controllers/submission.ts`, `middleware/errorHandler.ts` and `utils/validation.ts`, with `app.ts` reduced to wiring.

8. **Drill-down UI** from the reference screenshot: Model and Badge appear only once the level above has a value. The quick-select list became vertical and its border was removed.
   - The user had changed `MAX_BODY_SIZE` to `10mb`. That broke a test and no longer matched the frontend's 1 MB limit, so it was flagged rather than changed.

9. **Exact screenshot match and 1 MB limit.**
    - **Screen:** title "Drill Down Form", hidden dropdown labels, "Upload Logbook:" label, only the Tesla and BMW quick-select buttons, and no "Loaded:" line.
    - **1 MB limit:** `MAX_LOGBOOK_BYTES` added to `shared/`, measured in UTF-8 bytes on the server. The request size cap is kept above it to allow for encoding.
    - **New behaviour:** Submit stays disabled while the file is being read.

10. **Required logbook and popups.**
    - The logbook is required on both the form and the server ("Please upload logbook").
    - Only `.txt` files are accepted, by file extension ("Logbook should be txt file").
    - All errors are shown with `window.alert()`.

11. **Result page at `/upload`, rendered by the backend.** The user chose this over a frontend route.
    - **Backend:** `POST /upload` takes form-encoded fields and replies with plain text, with `nosniff` and CRLF→LF conversion. `/api/submit` and `cors` were removed, and `MAX_BODY_SIZE` became `4mb`.
    - **Frontend:** a native POST form with hidden fields replaced `fetch`, and `SubmissionResult` was deleted.
    - **Check:** verified end to end in the browser, landing on `localhost:3000/upload`.

12. **This file** was written to record the session.

### Final state

- **Tests:** backend 32 and frontend 36 pass, and `npm run typecheck` is clean.
- **Git:** the repo is initialised but has no commits yet.
- **`npm audit`:** only moderate warnings, from `minimatch` via the root dev dependency `eslint`, which the user added.

### Open ideas, not done

- A production build for the backend (bundle with esbuild, or emit with tsc) instead of running `tsx`.
- Replacing `window.alert()` with a custom modal. The change would be confined to `showError()`.
- Server-side errors (tampered requests) appear as a plain-text page, not a popup. That was an accepted trade-off of the backend-rendered `/upload`.
