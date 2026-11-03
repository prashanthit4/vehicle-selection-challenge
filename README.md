# Vehicle Selection Challenge

A vehicle selection form with drill-down **Make → Model → Badge** dropdowns, quick-select presets, and a required plain-text service logbook upload. The form uploads the vehicle and logbook file to a small Express backend, which parses it with **Multer**, validates it, and renders the result page at `/upload`.

Built with "function over polish" in mind: native React hooks, no state library, no UI framework, and one API route.

## Features

- **Drill-down selects:** at first only the Make dropdown is shown. Choosing a Make reveals Model, and choosing a Model reveals Badge.
  Changing the Make clears the Model, Badge and logbook. Changing the Model clears the Badge and logbook.
  The dropdown labels are hidden visually to match the reference design, but screen readers still read them.
- **Select a Vehicle:** a vertical list of buttons that fill in all three dropdowns at once. The buttons are set in `VITE_QUICK_SELECTS`, and the defaults are Tesla Model 3 Performance and BMW 130d xDrive 26d. The section is hidden when none are configured.
- **Logbook upload (required):** appears once a Badge is selected. Only `.txt` files (`text/plain`) up to the configured size limit, 1 MB by default, are accepted.
  - **When it's checked:** the file's name, type and size are checked as soon as it is picked, and again on Submit. A bad file is cleared with a popup, and nothing is sent until the file passes.
  - **How it's sent:** the file itself is uploaded as `multipart/form-data`.
- **Errors are popups:** every error is shown with the browser's `alert()`, never inline. For example, "Please upload logbook" when you submit without one, and "Logbook should be txt file" for any other file type. Size errors work the same way.
- **Result page at `/upload`:** a valid submit is a normal browser form POST to the backend. The browser navigates to `localhost:3000/upload`, which shows the vehicle and logbook as plain text. The browser's Back button returns to the form.

## Project structure

```
vehicle-selection-challenge/
├── package.json              # npm workspaces + root scripts
├── shared/                   # Single source of truth, imported as @vehicle/shared/*
│   ├── config.ts             # DEFAULT_MAX_LOGBOOK_BYTES, parseMaxSizeBytes(), formatBytes()
│   ├── constants.ts          # UPLOAD_PATH, allowed extensions/MIME types, user-facing messages
│   ├── templates.ts          # formatResultPage(): the /upload plain-text layout
│   ├── types.ts              # VehicleCatalog, VehicleSelection, VehicleSubmission
│   ├── utils.ts              # formatMake() display helper
│   └── vehicleData.json      # Make → Model → Badge[] catalog
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entry point: loads .env, calls app.listen()
│   │   ├── config.ts         # The only reader of process.env: PORT, MAX_LOGBOOK_BYTES, UPLOAD_LIMITS (Multer)
│   │   ├── app.ts            # Creates the Express app, attaches middleware, registers routes
│   │   ├── controllers/
│   │   │   └── submission.ts # POST /upload: req.body + req.file → validate → plain-text result page
│   │   ├── middleware/
│   │   │   ├── upload.ts     # Multer: memory storage, strict limits, type filter, error mapping
│   │   │   └── errorHandler.ts # Upload errors (400/413) and fallback 500 responses (text/plain)
│   │   └── utils/
│   │       └── validation.ts # validateSubmission(): pure field, file and catalog checks
│   └── test/                 # Mirrors src/
│       ├── app.test.ts       # HTTP tests via Supertest
│       ├── config.test.ts    # env parsing and fallbacks
│       ├── shared/shared.test.ts # @vehicle/shared: parser, constants, messages, template
│       └── utils/
│           └── validation.test.ts
└── frontend/
    ├── vite.config.ts        # Vite + Vitest config
    ├── src/
    │   ├── main.tsx
    │   ├── config.ts         # The only reader of import.meta.env: UPLOAD_URL, MAX_LOGBOOK_BYTES, QUICK_SELECTS
    │   ├── utils/quickSelects.ts # Parses VITE_QUICK_SELECTS against the catalog
    │   ├── App.tsx           # Page shell: heading + form
    │   └── components/
    │       ├── VehicleForm.tsx        # Drill-down state, quick select, file checks, multipart form
    │       ├── DropdownSelector.tsx   # Presentation-only labelled <select>
    └── test/                 # Mirrors src/
        ├── setup.ts          # jest-dom matchers + cleanup
        ├── App.test.tsx
        └── components/
            ├── VehicleForm.test.tsx
            └── DropdownSelector.test.tsx
```

## Getting started

Requirements: Node.js 20+ and npm 9+.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Scripts (run from the repo root)

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Runs the backend (tsx watch) and frontend (Vite) together |
| `npm test`          | Runs the backend and frontend test suites            |
| `npm run typecheck` | Type-checks both apps with `tsc --noEmit`            |
| `npm run build`     | Builds the frontend into `frontend/dist`             |
| `npm start`         | Runs the backend once, without watching for changes  |

To run one workspace on its own, for example: `npm test -w @vehicle/frontend`, or `npm run test:watch -w @vehicle/backend`.

### Environment variables

Each app reads a `.env` file in its own folder. `.env` is gitignored, so after cloning, copy the example files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Variable       | File            | Default if unset        | Purpose                                |
| -------------- | --------------- | ----------------------- | -------------------------------------- |
| `PORT`         | `backend/.env`  | `3000`                  | Port the API listens on                |
| `MAX_LOGBOOK_BYTES` | `backend/.env` | `1048576` (1 MB)  | Logbook size limit the server enforces, used as Multer's `limits.fileSize` |
| `VITE_API_URL` | `frontend/.env` | *(empty)*               | Backend base URL the form posts to. When empty, the form posts to `/upload` on its own origin |
| `VITE_MAX_LOGBOOK_BYTES` | `frontend/.env` | `1048576` (1 MB) | Logbook size limit the upload input enforces. **Keep it equal to the backend's `MAX_LOGBOOK_BYTES`** |
| `VITE_QUICK_SELECTS` | `frontend/.env` | *(none)* | "Select a Vehicle" buttons: a JSON array of `make-model-badge` strings, e.g. `'["tesla-Model 3-Performance","bmw-130d-xDrive 26d"]'` |

**How `VITE_QUICK_SELECTS` is read** (`frontend/src/utils/quickSelects.ts`):
- **Matching against the catalog:** each entry is looked up in `vehicleData.json`. The make, then the model, is matched as a known prefix, and the rest must be one of that model's badges. It is not split on `-`, so names that contain hyphens, such as `CX-5` or `GT-SP`, still work.
- **Case:** matching ignores case, and the buttons use the catalog's spelling. `FORD-ranger-raptor x` becomes Ford / Ranger / Raptor X.
- **Bad entries:** an entry that doesn't match the catalog, or isn't a string, is skipped with a console warning. Duplicates are dropped. Invalid JSON, or a value that isn't an array, gives no buttons.
- **Quoting:** wrap the whole value in single quotes in `.env`, because it contains double quotes and spaces.

Both size limits are parsed by the shared `parseMaxSizeBytes()`. Any value that isn't a positive whole number of bytes falls back to the 1 MB default, including `1mb`. Error messages are built from the limit, for example "Logbook must be 512 KB or smaller."

Each app reads the environment in exactly one module: `backend/src/config.ts` or `frontend/src/config.ts`.

The backend loads its `.env` with `dotenv`, and Vite loads the frontend's. **Variables already set in your shell win over `.env`.** If `PORT` is exported in the shell where you run `npm run dev`, the backend will use that value. Unset it, or start the apps in separate terminals with `npm run dev -w @vehicle/backend` and `npm run dev -w @vehicle/frontend`.

## API

### `POST /upload`

The frontend form posts here as a normal browser form submit, and the response **is** the result page. After a successful submit the browser address changes to `http://localhost:3000/upload`.

Request: `Content-Type: multipart/form-data`, with these parts:

| Part      | Kind | Example |
| --------- | ---- | ------- |
| `make`    | text field | `bmw` |
| `model`   | text field | `130d` |
| `badge`   | text field | `xDrive 26d` |
| `logbook` | file (`LOGBOOK_FIELD`) | `logbook.txt`, `text/plain` |

**Multer limits** (`UPLOAD_LIMITS` in `backend/src/config.ts`). Every part of the request a client controls is capped, so a malicious request can't use up memory:

| Limit | Value | Why |
| ----- | ----- | --- |
| `fileSize` | `MAX_LOGBOOK_BYTES` | The file is buffered in memory, so this caps the memory used per request |
| `files` | 1 | Only the logbook |
| `fields` | 3 | `make`, `model`, `badge` |
| `fieldSize` | 256 bytes | Catalog names are far shorter |
| `fieldNameSize` | 32 | |
| `parts` | 4 | 3 fields + 1 file |
| `headerPairs` | 20 | |

Multer runs only on this route, uses memory storage (nothing touches disk), and has a `fileFilter` that rejects a disallowed type before the file is buffered. Non-multipart bodies are never parsed.

Validation, in order:

- `make`, `model` and `badge` must be non-empty strings.
- A `logbook` file is required.
- The file name must end in one of `ALLOWED_EXTENSIONS` (`.txt`). The type must be one of `ALLOWED_MIME_TYPES` (`text/plain`), or unknown (`application/octet-stream`, which is how browsers send an unrecognised type).
- The file must be at most `MAX_LOGBOOK_BYTES`.
- The content must be valid UTF-8 text with no NUL bytes, so a binary file renamed to `.txt` is rejected as "Logbook should be txt file".
- An empty or whitespace-only file is accepted (see [Assumptions](#assumptions)).
- The vehicle must exist in `shared/vehicleData.json`. Make keys are lowercase, matching the catalog.

Every response is `text/plain; charset=utf-8`, with `X-Content-Type-Options: nosniff` so the echoed text can never be read as HTML.

| Status | Body | When |
| ------ | ---- | ---- |
| 200    | The result page, below | Valid submission |
| 400    | `Please upload logbook` | No file chosen (including a browser form's blank file part) |
| 400    | `Logbook should be txt file` | Wrong extension or type, or content that isn't text |
| 400    | `Unknown vehicle: …` / `make, model and badge are required strings.` | Bad vehicle fields |
| 400    | `Malformed upload.` | Any other Multer limit (an extra file, the wrong file field, extra or oversized fields, too many parts) or a broken multipart body |
| 413    | `Logbook must be 1 MB or smaller.` | File over `MAX_LOGBOOK_BYTES` (the message follows the limit) |

200 response body:

```
Make: bmw
Model: 130d
Badge: xDrive 26d

Logbook:

2020/05/01: Initial Service
2021/06/15: Check-Up
2022/02/01: Crashed into a pole. Major repairs.
```

If the uploaded logbook is empty or whitespace only, the line under `Logbook:` reads `no entries yet!!` (`EMPTY_LOGBOOK_TEXT` in `shared/templates.ts`).

## Assumptions

- **A logbook file is required, but its contents can be empty.** A new vehicle may not have any service entries yet, so a blank `.txt` file is a valid upload. Entries can be added to it later.
  - **No file chosen:** "Please upload logbook" pops up and the form isn't submitted. A browser form with no file still sends an empty file part with a blank filename, and the server also treats that as a missing logbook.
  - **An empty or whitespace-only `.txt` file** is accepted on both sides. The result page shows `no entries yet!!` under `Logbook:`.
  - **An empty file still has to be the right type.** For example, an empty `.pdf` is rejected with "Logbook should be txt file".
  - **Appending entries later isn't built yet.** Nothing is stored today: each upload is validated, shown and discarded. Adding entries later would need storage, such as a database or file store, and a way to identify each vehicle's logbook.

## Design decisions

- **A plain multipart form POST, parsed by Multer.** The browser uploads the file itself, along with hidden `make`, `model` and `badge` fields. The visible dropdowns have no `name`. This is the standard way to upload a file from a form. The size limit applies to the real file bytes, and the server gets the file's own name and type. No CORS is needed, because a normal form navigation isn't a cross-origin fetch.
- **The frontend never reads the file.** The browser already knows a picked file's name, type and size, which is enough to check presence, type and size before submitting. Checking that the content is real text needs the bytes, so the server does that.
- **Errors split by where they happen.** Everything the form can check (missing logbook, wrong type, size) is a popup, and the POST is blocked. Only problems the browser can't catch, such as a tampered request or binary content in a `.txt`, reach the backend, which replies with a plain-text error page.
- **Belt and braces on the server.** Multer's `fileFilter` and limits reject bad requests before the file is buffered. `validateSubmission` is a pure function that re-checks everything, so it can be unit-tested without HTTP.
- **Limits come from the environment, parsed by one shared function.** `VITE_MAX_LOGBOOK_BYTES` and `MAX_LOGBOOK_BYTES` both go through `parseMaxSizeBytes()`, with a shared 1 MB fallback. On the server, the limit is Multer's `limits.fileSize`.
- **Domain rules and wording live in `@vehicle/shared`.** The upload route, allowed extensions and MIME types, error messages and the result-page template are all defined once and used by both apps. The tests use them too. A separate test pins the literal template text and messages, so a change to the shared definitions can't slip through just because the tests reuse them.
- **File type: the extension is the main check, MIME type is secondary, and the server checks the content.** The browser's reported type isn't reliable. `.md`, `.log` and `.csv` files can all show up as `text/plain`. An unknown type shows as `''` in the page and as `application/octet-stream` in the upload. So a file must have an allowed extension, and its MIME type must be allowed or unknown. The `accept` attribute only filters the file picker, so the same shared checks run when a file is chosen, on Submit, and on the server. The server also checks that the content is real UTF-8 text.
- **Errors go through one `showError()` function** in `VehicleForm`, which calls `window.alert()`. To switch to a custom modal later, change that one function.
- **Options are worked out from the selection, not stored.** The Model and Badge lists are recalculated from the catalog on every render, so they can't fall out of sync with the current selection. Only the selected values are kept in state.
- **Quick select sets all three values at once.** It skips the step-by-step clearing, but changing the Make or Model afterwards still clears what depends on it.
- **The data lives in one shared place.** The frontend and backend both import `vehicleData.json` from `@vehicle/shared`. The dropdowns and the server-side validation use the same catalog, so they always agree.
- **No backend build step.** The backend runs TypeScript directly through `tsx`, and `tsc` only checks types. For a production deployment you'd usually bundle it to JavaScript first, for example with `esbuild` or `tsc` and an emit config.

## Testing

- **Backend** (`backend/test/`, Vitest + Supertest): unit tests for `validateSubmission` in `utils/validation.test.ts`, plus HTTP tests in `app.test.ts`. These send real multipart requests with `.field()` and `.attach()`. They check the exact result page and headers, a missing file (including a browser's blank file part), empty and whitespace-only files showing "no entries yet!!", wrong types, binary content, the size limit at and over 1 MB, and every Multer limit (a second file, the wrong file field, an extra field, an oversized field value, an overlong field name, a truncated body). `config.test.ts` lowers `MAX_LOGBOOK_BYTES` and confirms a 413 over HTTP.
- **Frontend** (`frontend/test/**/*.test.tsx`, Vitest + Testing Library + jsdom): `DropdownSelector` props, drill-down reveal and reset, quick-select filling, the layout, `.txt`-only uploads checked when a file is picked and again on Submit, the 1 MB limit, the "Please upload logbook" popup when no file is chosen, an empty file being accepted, and the multipart form submit. jsdom can't navigate, so the submit tests listen for the `submit` event after React has handled it. They check whether the POST was blocked and which fields would be posted. jsdom's `FormData` can't see files set by user-event, so the chosen file is asserted on the input instead.

The frontend tests don't need the backend running.
