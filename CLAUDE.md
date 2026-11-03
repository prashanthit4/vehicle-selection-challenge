# CLAUDE.md

Vehicle Selection Form: drill-down **Make → Model → Badge** dropdowns, quick-select buttons, and a required `.txt` service logbook upload. A valid submit is a browser `multipart/form-data` POST to the Express backend, which parses it with Multer and replies with a plain-text result page at `/upload`.

Principle: **function over polish**. Native React hooks only (no state library, no UI or CSS framework), minimal styling, no over-engineering.

## Commands (repo root)

```bash
npm install
npm run dev          # backend :3000 + frontend :5173
npm test             # Vitest, both apps
npm run lint         # ESLint (eslint.config.mjs)
npm run typecheck    # tsc --noEmit, both apps
npm run build        # frontend production build
```

Single workspace: `npm test -w @vehicle/frontend`, `npm run dev -w @vehicle/backend`.

## Layout (npm workspaces)

```
shared/      @vehicle/shared, imported as @vehicle/shared/{config,constants,templates,types,utils,vehicleData.json,quickSelects.json}
  vehicleData.json   catalog: lowercase make key → model → badge[]
  quickSelects.json  quick-select buttons, same shape as the catalog (one button per badge)
  config.ts          DEFAULT_MAX_LOGBOOK_BYTES, parseMaxSizeBytes(), formatBytes()
  constants.ts       UPLOAD_PATH, LOGBOOK_FIELD, ALLOWED_EXTENSIONS/MIME_TYPES, LOGBOOK_ACCEPT, has*() checks, messages
  templates.ts       formatResultPage(), EMPTY_LOGBOOK_TEXT
  types.ts           VehicleCatalog, VehicleSelection, VehicleSubmission
  utils.ts           formatMake(), listVehicles()
backend/     Express 5 + Multer 2, run with tsx (no build step)
  src/index.ts                   loads .env (dotenv, first import), app.listen(PORT)
  src/config.ts                  only reader of process.env: PORT, MAX_LOGBOOK_BYTES, UPLOAD_LIMITS
  src/app.ts                     nosniff header, POST /upload → parseLogbookUpload → uploadVehicle, errorHandler
  src/middleware/upload.ts       Multer (memory storage, UPLOAD_LIMITS, type fileFilter), maps errors to UploadError
  src/middleware/errorHandler.ts UploadError → its status/message; anything else 500 (text/plain)
  src/controllers/submission.ts  req.body + req.file → validateSubmission → result page or 400
  src/utils/validation.ts        validateSubmission(): pure checks on fields, file and catalog
frontend/    Vite + React 19
  vite.config.ts                 dev proxy for /upload; injects backend MAX_LOGBOOK_BYTES as __MAX_LOGBOOK_BYTES__
  src/config.ts                  UPLOAD_URL, MAX_LOGBOOK_BYTES
  src/hooks/useVehicleSelection.ts  selection state, derived options, clearing rules
  src/components/VehicleForm.tsx    renders dropdowns, quick selects, file input; checks file; submits
  src/components/DropdownSelector.tsx presentation-only labelled <select> (hideLabel option)
  src/styles.css                 layout only: 200px stacked controls, visually-hidden class
Tests live in backend/test and frontend/test, mirroring src/.
```

## Environment (all optional; a fresh clone runs with no .env)

| File | Variable | Default | Notes |
| ---- | -------- | ------- | ----- |
| `backend/.env` | `PORT` | `3000` | Shell variables win over `.env`. |
| `backend/.env` | `MAX_LOGBOOK_BYTES` | `1048576` | The single size limit. Used by Multer, and by the frontend via `vite.config.ts`. Invalid values fall back to 1 MB. |
| `frontend/.env` | `VITE_API_URL` | *(empty)* | Empty means the form posts to `/upload` on its own origin, and Vite proxies it in dev. |
| `frontend/.env` | `DEV_BACKEND_URL` | `http://localhost:3000` | Dev proxy target. Deliberately not derived from `PORT`, because tools that launch Vite set `PORT` to Vite's own port. |

## Behaviour rules (all covered by tests)

- **Drill-down:** only Make is shown at first. Model appears once a Make is chosen, and Badge once a Model is chosen. Changing Make clears Model and Badge, and changing Model clears Badge. Changing Make or Model, or applying a quick select, also clears the chosen file.
- **Options are derived, not stored:** each level's list is computed from the catalog on render.
- **Quick selects** come from `shared/quickSelects.json` and use exact catalog spellings. A test checks every entry exists in the catalog and that there are at least two. `VehicleForm` also accepts a `quickSelects` prop, and the section is hidden when the list is empty.
- **Logbook, in the browser:** `checkLogbookFile()` uses only `File` metadata and never reads the content. It runs when a file is picked (a bad file is cleared, with a popup) and again on Submit (which blocks the POST).
  - **Required:** no file gives `Please upload logbook`. An empty file is allowed, because a logbook can start with no entries.
  - **Type:** the extension must be in `ALLOWED_EXTENSIONS`. The MIME type must be in `ALLOWED_MIME_TYPES` or unknown (`''` or `application/octet-stream`). Otherwise the message is `Logbook should be txt file`.
  - **Size:** over `MAX_LOGBOOK_BYTES` gives `Logbook must be 1 MB or smaller.`, with the size taken from the limit.
- **Errors in the browser:** always a popup through `showError()`, which calls `window.alert()`. Never inline.
- **Submit:** `<form method="post" encType="multipart/form-data" action={UPLOAD_URL}>`. Hidden inputs post `make`, `model` and `badge`, and the file input posts as `LOGBOOK_FIELD` (`logbook`). The dropdowns have no `name`.
- **Backend `/upload`:**
  - **Multer limits:** `fileSize` = `MAX_LOGBOOK_BYTES`, `files` 1, `fields` 3, `fieldSize` 256 B, `fieldNameSize` 32, `parts` 4, `headerPairs` 20. When you add a form field, raise `fields` and `parts`.
  - **No file chosen:** a browser part with a blank filename is dropped by Multer, so it counts as a missing logbook.
  - **Validation:** checks the vehicle fields, then that a file is present, its type, its size, that it's valid UTF-8 with no NUL bytes, and that the vehicle is in the catalog.
  - **200:** `text/plain` with `nosniff`, body `Make: <make>\nModel: <model>\nBadge: <badge>\n\nLogbook:\n\n<text>\n`. The make is printed as the raw key. An empty or whitespace-only logbook shows `no entries yet!!`.
  - **Errors (plain text):**
    - 400 with the validation message,
    - 400 `Logbook should be txt file` from the type filter,
    - 413 with the size message,
    - 400 `Malformed upload.` for other Multer limits or an unparseable body.

## Conventions

- **No hardcoded limits, paths, field names, file types, messages or templates in app code.** These come from `@vehicle/shared`, or from env through each app's `config.ts`. Tests import the same definitions. `backend/test/shared/shared.test.ts` pins the literal wording and layout.
- **`vite.config.ts` imports shared code by relative path** (`../shared/...`), because Node can't load the package's `.ts` files directly.
- **jsdom can't navigate:** frontend submit tests listen for `submit` on `document`, which runs after React's root handler, and check `defaultPrevented` and `FormData`. jsdom's `FormData` can't see files set by user-event, so assert the chosen file on the input instead.
- **The dev servers may already be running** on :3000 and :5173. Check before starting new ones.
