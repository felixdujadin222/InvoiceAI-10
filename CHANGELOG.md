# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-08-23

### Added
- Unit test suite (Vitest + jsdom) covering validation, auth helpers, and utilities — 28 specs, fully offline
- Coverage tooling with enforced thresholds (`vitest.config.ts`, v8 provider)
- CI workflow: lint → typecheck → test → audit → build on every push/PR
- Dependabot config for npm and GitHub Actions ecosystems
- `.env.example` documentation for all environment variables including `PORT`

### Changed
- Strict typing across services: replaced `any` payloads with `InvoiceData`, `ClientData`, `QuoteData`, `RecurringInvoiceData`
- `escapeHtml` now performs real entity encoding (`&amp;`, `&lt;`, `&gt;`, `&quot;`) — previously a no-op for those characters
- Server port configurable via `PORT` env var
- Structured stdout logging on the server (no bare console statements)
- README rewritten with architecture, environment, testing, and CI sections

### Fixed
- Removed dead code: unused imports across components/services, leftover debug servers, empty catch handlers
- jspdf-autotable v5 integration (`autoTable(doc, …)` instead of removed prototype plugin)

## [1.0.0] - Initial release
- Invoice generation from natural language via Gemini
- Client, expense, quote, and recurring-invoice management
- Firebase auth + Firestore sync with offline fallback
- PDF export, public invoice sharing, dashboard analytics
