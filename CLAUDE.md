# Wealth Management App — CLAUDE.md

## Project Overview
Personal wealth management dashboard for tracking: commodities (gold/silver), cash, II. pilier (Slovak pension), bank accounts, and crypto (Binance/CoinGecko). Includes AI-powered recommendations via Claude API.

**GitHub:** https://github.com/DusanOravsky/wealth-management
**Hosting:** GitHub Pages (static export)
**Owner:** DusanOravsky

---

## Architecture

### Hosting Constraint: Static Export
This app uses `output: 'export'` in Next.js — **no server-side code, no API routes, no Node.js runtime at deploy time.** Everything runs in the browser.

### Data Storage
All user data is stored in **browser localStorage**, encrypted with AES-256-GCM using the Web Crypto API. The encryption key is derived from the user's PIN using PBKDF2. No data ever leaves the device except for direct API calls the user initiates.

### Security Model
- PIN is hashed (SHA-256) and stored in localStorage — never in plaintext
- All sensitive data (portfolio amounts, API keys) encrypted with key derived from PIN
- API keys (Binance, CoinGecko, Claude) stored encrypted in localStorage
- Session: PIN unlocks the app per browser session (sessionStorage flag)

### API Integrations (all client-side)
- **CoinGecko** — free public API, no key required for basic use
- **Binance** — user provides Read-Only API key + secret, stored encrypted
- **Claude API** — user provides API key, stored encrypted; used for AI recommendations

---

## Tech Stack
- **Framework:** Next.js 15 (App Router, static export)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui
- **Charts:** Recharts
- **Crypto/Security:** Web Crypto API (browser-native, no external deps)

---

## Project Structure
```
src/
  app/                    # Next.js App Router pages
    page.tsx              # PIN unlock screen (entry point)
    dashboard/page.tsx
    commodities/page.tsx
    cash/page.tsx
    pension/page.tsx
    bank/page.tsx
    crypto/page.tsx
    planning/page.tsx
    advisor/page.tsx      # AI recommendations
    settings/page.tsx
  components/
    layout/               # AppShell, Sidebar, Nav
    ui/                   # shadcn/ui components (auto-generated)
    modules/              # Feature-specific components
  lib/
    crypto.ts             # AES-256-GCM encrypt/decrypt, PIN hashing, key derivation
    store.ts              # localStorage data layer (typed read/write)
    types.ts              # All TypeScript interfaces/types
    coingecko.ts          # CoinGecko API client
    binance.ts            # Binance API client (HMAC-SHA256 signing)
    claude.ts             # Claude API client for recommendations
    constants.ts          # App-wide constants
  hooks/
    useStore.ts           # React hook for encrypted store
    usePIN.ts             # PIN session management
    usePrices.ts          # Live price fetching hook
```

---

## Dev Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Static export to ./out/
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```

---

## Coding Conventions
- **TypeScript strict mode** — no `any`, no `as any`
- Components: function components with named exports
- File naming: kebab-case for files, PascalCase for components
- Keep components small — split into sub-components if >150 lines
- All localStorage access goes through `lib/store.ts` — never direct `localStorage` calls elsewhere
- All encryption/decryption goes through `lib/crypto.ts`
- API clients in `lib/` are pure functions (no React hooks)
- Hooks in `hooks/` wrap lib functions with React state

---

## Key Constraints
1. **No server-side code** — everything runs in browser
2. **No external auth services** — PIN only
3. **No database** — localStorage only
4. **Static export** — `next/headers`, `cookies()`, `redirect()` server-side are off-limits
5. **No `useLayoutEffect` on server** — wrap in `dynamic(() => ..., { ssr: false })` where needed
6. **GitHub Pages base path** — if repo name is used as subpath, set `basePath` in next.config.ts

---

## GitHub Actions
`.github/workflows/deploy.yml` — on push to `main`: build → export → deploy to `gh-pages` branch.

---

## Module Data Models (summary)
See `src/lib/types.ts` for full definitions.

- `Commodity`: { id, name, symbol, unit, amount, purchasePrice, currency }
- `CashEntry`: { id, label, amount, currency }
- `PensionEntry`: { id, provider, value, currency, updatedAt }
- `BankAccount`: { id, bank, name, iban, balance, currency }
- `CryptoHolding`: { id, coinId, symbol, amount, exchange }
- `AppSettings`: { pinHash, binanceKey, binanceSecret, coingeckoKey, claudeKey } — all encrypted fields base64

---

## AI Recommendations
The advisor sends a sanitized portfolio snapshot (no API keys, no personal identifiers beyond amounts) to `claude-sonnet-4-6` and receives structured recommendations. Prompt engineering in `lib/claude.ts`.
