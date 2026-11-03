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

Optional settings are listed in `backend/.env.example` and `frontend/.env.example`: the port, the logbook size limit (1 MB by default), and the backend URL.

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
- **The dropdown options come from the catalog.** Only the selected values are kept in state. The Model and Badge lists are worked out from the catalog on each render, and changing a level clears the levels below it.
- **Quick selects use the catalog's own shape.** `shared/quickSelects.json` is make → model → badges, like `vehicleData.json`, and each badge becomes one button. A test checks that every entry exists in the catalog. In production this list would come from the backend or an admin-managed store, so it could change without a deploy.
- **A normal form post, with Multer on the server.** The file is uploaded as `multipart/form-data`, and the backend replies with the result page itself.
  - **Limits on every part of the request:** at most one file of up to 1 MB, three short text fields, and a few parts in total. Uploads are kept in memory and never written to disk.
  - **Upload errors:** anything else gets a clear 400 or 413 response.
  - **Safe output:** responses are `text/plain` with `nosniff`, so uploaded text can never run as HTML.
- **Checks happen in two places.**
  - **The form** checks the file's presence, type (extension and MIME type) and size when it's picked and again on Submit. It shows a popup and blocks the upload if a check fails.
  - **The server** repeats the same checks, and also rejects content that isn't real text.

### Assumptions

- **The logbook file is required, but it can be empty.** A vehicle may not have any service entries yet. An empty `.txt` is accepted, and the result page shows `no entries yet!!`.
- **Adding entries later isn't built yet.** Nothing is stored today. It would need a database or file store.
- **Server-side errors appear as a plain-text page.** Everything the form can catch is a popup. Only problems the browser can't detect, such as a tampered request or binary content saved as `.txt`, reach the server.
