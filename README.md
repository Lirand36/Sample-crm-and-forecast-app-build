# Signature Path Forecasting — Full MVP

An evidence-led B2B forecast for quarterly signatures, with a minimal CRM as its system of record. It is one Next.js app with two areas, `/crm` and `/forecast`, deployed on Vercel's free tier.

There is no database. Each browser keeps its own copy of the data in IndexedDB, seeded from bundled fictional fixtures, and **Settings > Administration > Restore baseline data** restores it. This is a single-presenter demo: the "Signed in as" switcher simulates the CRO, the VP Sales, RevOps and two Sales Managers.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # lint + typecheck + unit/integration/property tests
npm run build
npm run test:e2e     # browser smoke test; needs a running app (BASE_URL, default http://localhost:3000)
```

## Layout

```
src/
  app/                 Next.js routes: /crm, /forecast
  features/            UI by area (shell, crm, forecast, deal, review, history, backtest, config)
  domain/              pure entities, dates, money, rules (no UI, storage, network or clock)
  application/         ports (repository interfaces), services such as reset
  infrastructure/      IndexedDB and in-memory stores; D-09 adapters (.eml reader, fixtures)
  seed/                canonical seed (PRD v5 §8 + handoff Part VII), .eml fixtures, BT-1
tests/                 unit, integration, property, e2e
docs/                  readiness note, implementation decisions, open issues, traceability
```

## Deploying to Vercel (Hobby)

Import this repository as a new Vercel project. The defaults work: framework Next.js, `npm run build`, no environment variables. Every branch push gets a preview URL.

## Status

Phase 1 (Foundation) is complete. See `docs/traceability.md` for test status and `docs/implementation-decisions.md` for decisions.
