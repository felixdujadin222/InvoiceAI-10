# InvoiceFlow AI

AI-powered invoicing for freelancers: generate invoices from plain-language job descriptions (Gemini), manage clients/expenses/quotes/recurring billing, export PDFs, and share public invoice links.

## Architecture

```
┌─ React 19 SPA (Vite + Tailwind) ────────────────────────┐
│  components/   UI screens (Dashboard, Invoices, …)      │
│  lib/          pure logic: validation, auth helpers, cn │
│  services/     integrations:                            │
│    dbService      Firestore sync + localStorage cache   │
│    geminiService  AI parsing (called from frontend)     │
│    pdfService     jsPDF invoice rendering               │
│    firebase       Firebase app/auth/db singletons       │
└──────────────────────────────────────────────────────────┘
        │                                   │
   Express server (server.ts)        Firebase (Auth+Firestore)
   dev: Vite middleware/HMR          offline fallback to
   prod: serves dist/                localStorage via dbService
```

- **Data flow**: UI → `dbService` → Firestore when online, `localStorage` when offline; a merge layer (`mergeLocalOnly`, `shouldSyncFirestore`) reconciles on reconnect.
- **Validation boundary**: every persisted invoice/client passes through `src/lib/validation.ts` (sanitize + validate) before reaching storage.
- **AI calls** run in the frontend only; the Express server serves the SPA and health endpoint.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your Firebase + Gemini keys.
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

## Environment Variables

All client-side variables use the `VITE_` prefix. See [.env.example](.env.example) for the full list:

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_PROJECT_ID` | Firestore project |
| `VITE_GEMINI_API_KEY` | Gemini API key for AI features |
| `PORT` | Server port (default `3000`) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm test` | Run tests **with coverage thresholds** (fails below threshold) |
| `npm run lint` | ESLint with zero-warning policy |
| `npm run typecheck` | `tsc --noEmit` |

## Testing

Tests run fully offline — no network, Firebase, or Gemini access required.

```bash
npm test         # vitest run --coverage
npm run test:watch
```

Coverage targets the pure logic layer in `src/lib/` and is enforced by thresholds in [vitest.config.ts](vitest.config.ts). CI runs lint, typecheck, tests, dependency audit, and build on every push and pull request (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Contributing

See [CHANGELOG.md](CHANGELOG.md) for release history. Keep changes in small commits with their tests; Dependabot opens weekly dependency updates.

