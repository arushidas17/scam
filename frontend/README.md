# Fraud Guardian

Invoice and payment fraud detection for finance and accounts-payable teams.
React + Vite, Tailwind, React Router, Framer Motion, Recharts, lucide-react.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

Any email and password signs you in — the auth service is a mock (see below).

## Routes

| Route                | Status                                                    |
| -------------------- | --------------------------------------------------------- |
| `/`                  | Landing page                                               |
| `/login`, `/signup`  | Auth, split layout                                         |
| `/dashboard`         | Stats, 14-day chart, top risk reasons, recent alerts       |
| `/upload`            | Three-step upload → review → result flow                   |
| `/invoices`          | Filterable, sortable, paginated list; review queue         |
| `/invoices/:id`      | Invoice detail — evidence, decisions, queue navigation     |
| `/vendors`           | Vendor list with search, tabs and sorting                  |
| `/vendors/:id`       | Vendor profile — trend, bank history, invoice history      |
| `/payment-checker`   | Paste an email and see what it is really asking for        |
| `/settings`          | **Placeholder** — the only one left                        |

Everything under the app shell is wrapped in `ProtectedRoute`, which bounces
signed-out users to `/login` and remembers where they were headed.

## Design tokens

Everything visual lives in `tailwind.config.js` — `base.*` surfaces, `hairline`
borders, the single `accent` ramp, the `ink.*` text ramp, `risk.*`, the display
type scale, spacing, radii and shadows. Shared classes (`.shell`, `.surface`,
`.surface-panel`, `.card-interactive`, `.checkbox`, `.eyebrow`) are in
`src/index.css`.

**The one rule worth keeping:** red, amber and green come only from `risk.*` and
only ever mean Suspicious / Needs Review / Normal, and each band carries an icon
and a label so status never rides on colour alone. `src/lib/risk.js` is the only
place a score becomes a band:

```
Normal 0–30 · Needs Review 31–60 · Suspicious 61–100
```

Form-error red is the one deliberate exception. The password strength meter uses
the accent ramp rather than red→green, so a weak password cannot read as a
suspicious invoice.

## Reusable components

`src/components/ui` holds the shared pieces: `Button`, `StatTile`, `RiskBadge`
(+ `RiskScoreChip`), `StatusPill`, `RiskGauge`, `DataTable`, `Pagination`,
`FileDropzone`, `Skeleton`, `EmptyState`, `Dialog`, `Toast`, `DiffText`,
`MaskedAccount`, `Logo`.

`src/components/risk` holds the pieces that explain a score, shared by the
invoice detail page, the upload result and the payment checker, so a score is
explained the same way wherever it appears: `FlagCard`, `ScoreBreakdownBar`,
`Evidence` (bank / domain / amount / duplicate / pair comparisons) and
`RecommendationCard`.

`src/components/app` holds the shell: `AppShell`, `Sidebar`, `TopBar`,
`UserMenu`, `ProtectedRoute`, `PageHeader`, `navItems`.

## Numbers

All money goes through `formatINR` in `src/lib/format.js`
(`Intl.NumberFormat('en-IN')` → `₹8,42,000`), and every figure, account number,
GSTIN and IFSC code renders in JetBrains Mono with `tabular-nums` so columns line
up. Dates and relative times are in `src/lib/time.js`.

Bank account numbers are masked to the last four digits everywhere, by going
through `MaskedAccount` (`src/lib/mask.js` holds the masking itself). Revealing
one is always an explicit, per-instance toggle.

**Score invariant:** a risk score is the sum of its flags' points. The data is
generated that way rather than scored separately, so a breakdown bar can never
disagree with the number above it. `src/lib/mockInvoices.js` enforces it with
`distribute()`; invoices where nothing was found score 0.

## Motion

`src/lib/motion.js` holds durations and easing; `useReducedMotion` feeds a single
`MotionConfig` in `src/App.jsx`, and components branch on it so
`prefers-reduced-motion` turns motion off rather than merely shortening it.
Animation is limited to transform and opacity, except the risk gauge arc, which
has to animate `stroke-dasharray`. App screens use 150–300ms; nothing loops
except the upload processing state.

## Data

No backend. Two mock services, and the pages call nothing else:

- `src/services/auth.js` — `signIn`, `signUp`, `signInWithGoogle`, `signOut`,
  `readSession`. The session is a localStorage stand-in for Supabase's own.
- `src/services/invoices.js` — `getDashboardStats`, `getRecentAlerts`,
  `listInvoices(filters)`, `getInvoice(id)`, `decideInvoice(id, action, note)`,
  `extractInvoice(file)`, `saveInvoice(data)`.
- `src/services/vendors.js` — `listVendors(filters)`, `getVendor(id)`,
  `setVendorTrusted(id, trusted)`.
- `src/services/paymentChecker.js` — `analysePaymentRequest({ from, subject, body })`,
  plus `sampleRequest()` and `benignRequest()`.

Each takes 400–900ms, which is what the skeleton states are built around.
Decisions and trusted flags are held in memory for the session only.

`analysePaymentRequest` is the one mock that really reads its input: it matches
the sender domain against the vendor list (exact, then edit distance for
lookalikes), scans for urgency, secrecy and payout-change phrases, and finds
account numbers and IFSC codes by pattern. Different emails genuinely produce
different reports — the bundled sample scores 100, the benign one scores 0.

`src/lib/mockInvoices.js` generates the corpus from a seeded PRNG, so the data is
identical on every reload: 19 vendors with bank-change histories, 40 generated
invoices, ABC Technologies' settled history, and one hand-authored flagship
invoice (`inv_abc_001`) scoring 87 from exactly three flags — bank account
changed (+40), lookalike sender domain (+30), amount above the vendor average
(+17). That invoice is the demo screen: open `/invoices/inv_abc_001`.

**Known inconsistency:** `getDashboardStats` returns fixed sample figures for a
full day of traffic (142 today / ₹8,42,000 at risk) while `/invoices` browses the
40-row corpus. The 14-day chart is generated to match the tiles, so the dashboard
is coherent on its own, but the tile counts will not equal the list counts. A
real endpoint replaces both and the two scales converge.
