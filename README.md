# Vehicle Selection Challenge

A drill-down **Make → Model → Badge** form with quick-select buttons and a plain-text service logbook upload. The form posts to an Express backend, which renders the result at `/upload`.

React + TypeScript (Vite) frontend, Express + TypeScript backend, and a `shared/` package for the vehicle catalog, quick selects, types and rules used by both apps.

## 1. Run it

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The backend runs on :3000. No `.env` setup is needed: in development, Vite forwards `/upload` to the backend.

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Starts frontend and backend         |
| `npm test`          | Runs both test suites (Vitest)      |
| `npm run lint`      | Runs ESLint                         |
| `npm run typecheck` | Type-checks both apps               |

Optional settings are listed in `backend/.env.example` and `frontend/.env.example`. The logbook size limit (1 MB by default) is set once, in `backend/.env`: the frontend reads it at build time, so the form and server can't disagree.

## 2. Check it against the brief

| Requirement | How to see it |
| ----------- | ------------- |
| Pick a Make, then that Make's Models | Choose **Ford**. The Model list shows Ranger, Falcon and Falcon Ute. |
| Then the Badge | Choose **Ranger**. The Badge list shows Raptor, Raptor X and Wildtrak. |
| Upload the logbook once a Badge is chosen | "Upload Logbook:" appears after a Badge is picked. Try `sample files/ford.txt`. |
| Changing Make or Model clears what depends on it | Change the Model to Falcon. The Badge resets and its list becomes XR6, XR6 Turbo and XR8. |
| At least two quick-select buttons | Under **Select a Vehicle**, each button fills in all three dropdowns. |
| Submit | Shows the vehicle and logbook as a plain-text page at `/upload`. |

Error popups to try:
- **"Please upload logbook":** submit without choosing a file.
- **"Logbook should be txt file":** choose any non-`.txt` file.

## 3. Key decisions

- **Shared rules, defined once.** The catalog (`vehicleData.json`), the quick selects (`quickSelects.json`), the file-type rules, the error messages and the result-page layout all live in `shared/`. The form, the server and the tests use the same definitions, so they can't drift apart.
- **Vehicle data is the provided JSON, held in memory.** The brief allowed a hard-coded map or a JSON file read into memory. `shared/vehicleData.json` is imported by both apps, so the dropdowns and the server validation always use the same catalog.
- **The selection state lives in a `useVehicleSelection` hook.** Only the selected values are stored. Each level's options are worked out from the catalog on every render, so they can't go stale, and choosing a level clears the levels below it. The hook has its own tests, and `VehicleForm` only renders, checks the file and submits.
- **Quick selects use the catalog's own shape.** `shared/quickSelects.json` is make → model → badges, like `vehicleData.json`, and each badge becomes one button. A test checks that every entry exists in the catalog.
- **A normal form post, with Multer on the server.** This matches the reference: the form submits to `/upload`, and the backend replies with the plain-text result page itself. The file is uploaded as `multipart/form-data`.
  - **Limits on every part of the request:** at most one file of up to 1 MB, three short text fields, and a few parts in total. Uploads are kept in memory and never written to disk.
  - **Upload errors:** anything else gets a clear 400 or 413 response.
  - **Safe output:** responses are `text/plain` with `nosniff`, so uploaded text can never run as HTML.
- **Checks happen in two places.**
  - **The form** checks the file's presence, type (extension and MIME type) and size when it's picked and again on Submit. It shows a popup and blocks the upload if a check fails.
  - **The server** repeats the same checks, and also rejects content that isn't real text.

### Assumptions

- **The logbook file is required, but it can be empty.** A vehicle may not have any service entries yet. An empty `.txt` is accepted, and the result page shows `no entries yet!!`.
- **Adding entries later isn't built yet.** Nothing is stored today (see Next steps).

## 4. Trade-offs and next steps

**Trade-offs I made on purpose**
- **Options are derived, not fetched.** The catalog is small, static and supplied with the brief, so the dropdowns update instantly, with no loading states, no race conditions and no extra endpoints. If it became large or changed often, I'd fetch it from the API instead:
  - **Endpoints:** `GET /api/makes`, `/api/makes/:make/models` and `/api/makes/:make/models/:model/badges`.
  - **Frontend:** fetch each level when the one above changes, cancel stale requests with `AbortController` so a slow response can't overwrite a newer choice, and cache the results.
- **The result page is rendered by the server.** It matches the reference, and it keeps the frontend simple. The cost: a problem only the server can detect, such as a tampered request or binary content saved as `.txt`, shows as a plain-text page rather than a popup. Everything the form can check is caught first. The alternative is posting with `fetch` to a JSON endpoint and showing the result in a React route.
- **Errors use `window.alert()`,** as the requirements asked. Every message goes through one `showError()` function, so swapping in a modal is a one-function change.

**Next steps**
- **Store logbooks** in a database or file store, so entries can be added to an existing logbook.
- **Serve the catalog and quick selects from the backend,** or an admin-managed store, so they can change without a deploy.
- **Production build of the backend.** It currently runs TypeScript through `tsx`. Compile or bundle it to JavaScript, and serve the frontend and `/upload` from the same host. The Vite dev proxy only exists in development.
- **Upgrade Vitest** to clear the `npm audit` advisories in its dependencies. They affect the test runner only, not the app.
