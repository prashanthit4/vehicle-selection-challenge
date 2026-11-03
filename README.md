# Vehicle Selection Challenge

A vehicle selection form with drill-down **Make → Model → Badge** dropdowns, quick-select presets, and a required plain-text service logbook upload. The form posts to a small Express backend, which validates the submission and renders the result page at `/upload`.

Built with "function over polish" in mind: native React hooks, no state library, no UI framework, and one API route.

## Features

- **Drill-down selects:** at first only the Make dropdown is shown. Choosing a Make reveals Model, and choosing a Model reveals Badge.
  Changing the Make clears the Model, Badge and logbook. Changing the Model clears the Badge and logbook.
  The dropdown labels are hidden visually to match the reference design, but screen readers still read them.
- **Select a Vehicle:** a vertical list of buttons that fill in all three dropdowns at once (Tesla Model 3 Performance, BMW 130d xDrive 26d).
- **Logbook upload (required):** appears once a Badge is selected. Only `.txt` files up to 1 MB are accepted, read in the browser with the `FileReader` API. Submit stays disabled until the file has been read.
- **Errors are popups:** every error is shown with the browser's `alert()`, never inline. For example, "Please upload logbook" when you submit without one, and "Logbook should be txt file" for any other file type. Size, read, server and network errors work the same way.
- **Result page at `/upload`:** a valid submit is a normal browser form POST to the backend. The browser navigates to `localhost:3000/upload`, which shows the vehicle and logbook as plain text. The browser's Back button returns to the form.

## Project structure

```
vehicle-selection-challenge/
├── package.json              # npm workspaces + root scripts
├── shared/                   # Single source of truth, imported as @vehicle/shared/*
│   ├── types.ts              # VehicleCatalog, VehicleSelection, VehicleSubmission
│   ├── utils.ts              # formatMake() display helper
│   └── vehicleData.json      # Make → Model → Badge[] catalog
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entry point: loads .env, calls app.listen()
│   │   ├── app.ts            # Creates the Express app, attaches middleware, registers routes
│   │   ├── controllers/
│   │   │   └── submission.ts # POST /upload: validate, render the plain-text result page
│   │   ├── middleware/
│   │   │   └── errorHandler.ts # Unparseable body, 413 and fallback 500 responses (text/plain)
│   │   └── utils/
│   │       └── validation.ts # validateSubmission(): pure payload + catalog checks
│   └── test/                 # Mirrors src/
│       ├── app.test.ts       # HTTP tests via Supertest
│       └── utils/
│           └── validation.test.ts
└── frontend/
    ├── vite.config.ts        # Vite + Vitest config
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx           # Page shell: switches between the form and the result view
    │   └── components/
    │       ├── VehicleForm.tsx        # Cascading state, quick select, FileReader, submit
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
| `MAX_BODY_SIZE`| `backend/.env`  | `4mb`                   | Request body cap. Keep it well above the 1 MB logbook limit (see below) |
| `VITE_API_URL` | `frontend/.env` | *(empty)*               | Backend base URL the form posts to. When empty, the form posts to `/upload` on its own origin |

The backend loads its `.env` with `dotenv`, and Vite loads the frontend's. **Variables already set in your shell win over `.env`.** If `PORT` is exported in the shell where you run `npm run dev`, the backend will use that value. Unset it, or start the apps in separate terminals with `npm run dev -w @vehicle/backend` and `npm run dev -w @vehicle/frontend`.

## API

### `POST /upload`

The frontend form posts here as a normal browser form submit, and the response **is** the result page. After a successful submit the browser address changes to `http://localhost:3000/upload`.

Request (`Content-Type: application/x-www-form-urlencoded`), fields:

| Field         | Example                         |
| ------------- | ------------------------------- |
| `make`        | `bmw`                           |
| `model`       | `130d`                          |
| `badge`       | `xDrive 26d`                    |
| `logbookText` | the `.txt` file's contents      |

Validation:

- `make`, `model` and `badge` must be non-empty strings.
- The combination must exist in `shared/vehicleData.json`. Make keys are lowercase, matching the catalog.
- `logbookText` is required: a non-blank string of at most 1 MB in UTF-8 bytes. The CRLF line breaks browsers send are turned back into LF first.
- Any extra fields are ignored.

Every response is `text/plain; charset=utf-8`, with `X-Content-Type-Options: nosniff` so the echoed text can never be read as HTML.

| Status | Body | When |
| ------ | ---- | ---- |
| 200    | The result page, below | Valid submission |
| 400    | The error message, e.g. `Please upload logbook` | Validation failure, including a logbook over 1 MB |
| 413    | `Payload too large.` | Request body over `MAX_BODY_SIZE` (default 4 MB) |

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

## Design decisions

- **A plain form POST, with the logbook sent as text.** The browser reads the `.txt` file with `FileReader` and copies the text into a hidden `logbookText` field. The visible controls have no `name`, so only `make`, `model`, `badge` and `logbookText` are posted, and the file itself never is. The backend needs no `multer` or multipart parsing, just `express.urlencoded()`. It also needs no CORS, because a normal form navigation isn't a cross-origin fetch.
- **Errors split by where they happen.** Everything the form can check (missing logbook, wrong type, size, read failure) is a popup, and the POST is blocked. Only problems the browser can't catch, like a tampered request, reach the backend, which replies with a plain-text error page.
- **One 1 MB logbook limit, enforced in both places.** `MAX_LOGBOOK_BYTES` lives in `shared/utils.ts`. The upload input and `validateSubmission` both check against it. The request body cap is set separately and higher, because URL-encoding the text (spaces, newlines and punctuation become `%XX`) can roughly triple the request size. A 1 MB file the form accepts is never rejected by the server for size.
- **`.txt` is checked by file extension, not MIME type.** The browser's reported type isn't reliable: `.md`, `.log` and `.csv` files can all show up as `text/plain`. The `accept=".txt"` attribute only filters the file picker, so the form checks the extension again when a file is chosen.
- **Errors go through one `showError()` function** in `VehicleForm`, which calls `window.alert()`. To switch to a custom modal later, change that one function.
- **Options are worked out from the selection, not stored.** The Model and Badge lists are recalculated from the catalog on every render, so they can't fall out of sync with the current selection. Only the selected values are kept in state.
- **Quick select sets all three values at once.** It skips the step-by-step clearing, but changing the Make or Model afterwards still clears what depends on it.
- **The data lives in one shared place.** The frontend and backend both import `vehicleData.json` from `@vehicle/shared`. The dropdowns and the server-side validation use the same catalog, so they always agree.
- **No backend build step.** The backend runs TypeScript directly through `tsx`, and `tsc` only checks types. For a production deployment you'd usually bundle it to JavaScript first, for example with `esbuild` or `tsc` and an emit config.

## Testing

- **Backend** (`backend/test/`, Vitest + Supertest): unit tests for `validateSubmission` in `utils/validation.test.ts`, plus HTTP tests in `app.test.ts`. These check the exact text of the result page, the `text/plain` and `nosniff` headers, CRLF normalisation, validation errors, the 1 MB logbook limit with URL-encoding overhead, the 413 body limit, and unknown routes.
- **Frontend** (`frontend/test/**/*.test.tsx`, Vitest + Testing Library + jsdom): `DropdownSelector` props, drill-down reveal and reset, quick-select filling, the layout, `.txt`-only uploads, the 1 MB limit and read errors (each as a popup), and the form submit. jsdom can't navigate, so the submit tests listen for the `submit` event after React has handled it. They check whether the POST was blocked, plus the exact fields and the `action` the browser would post.

The frontend tests don't need the backend running.
