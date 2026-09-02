# Resilient-Agent-Relay — Design System
**Specification Version**: 2.1 (Canonical Light Edition)  
**Product Positioning**: *Autonomous checkout recovery with bounded authorization.*  
**Subtitle**: *The transaction reliability layer for agentic commerce.*  
**Core Product Philosophy**:  
> **AI recommends. Policy authorizes. Razorpay executes. Audit proves.**

---

## 1. Design Direction

The **Resilient-Agent-Relay** interface is a **Light FinTech Transaction Control Plane**. It is designed for merchants, payment operations leads, and platform engineers who oversee autonomous commerce workflows. 

The aesthetic marries **ClickUp’s operational information density and modular light dashboard structure** with **Mercury’s premium typographic discipline, measured restraint, and calm financial authority**. 

The interface communicates mathematical determinism, transparent bounding, and instant transaction comprehension without resembling a cluttered developer test harness or an AI marketing gimmick.

---

## 2. Design Principles

1. **AI Recommends, Policy Authorizes, Razorpay Executes, Audit Proves**  
   The UI visually decouples advisory intelligence from monetary authority. AI models never execute payments; deterministic policy code gates every rupee, and Razorpay settles the transaction.
2. **5-Second Transaction Comprehension**  
   A user must understand the full incident within 5 seconds: *What failed? What did Gemini suggest? Why did Policy allow or block it? What order was created in Razorpay? Why is it marked PAID?*
3. **The Recovery Story is the Hero**  
   The primary visual anchor of the interface is the transaction replacement narrative (`ORIGINAL (OUT_OF_STOCK)` $\rightarrow$ `AUTHORITY GATES` $\rightarrow$ `RECOVERED SUBSTITUTE`). The 10-step execution pipeline serves as subordinate evidence beneath it.
4. **Quiet FinTech Authority & SVG Iconography**  
   Avoid neon cyberpunk accents, rainbow gradients, glowing orbs, or informal emojis. Use disciplined neutrals, crisp white surfaces, subtle 1px gray borders, and a standardized, minimalist SVG outline icon system.
5. **Spacious Between Sections, Compact Within Groups**  
   Apply generous vertical breathing room between major functional modules (48px–72px), while maintaining high information density within operational data tables and key-value pairs (12px–20px).
6. **Zero Ambient Magic**  
   Every state change must point to immutable evidence: an event timestamp, a cryptographic webhook hash, a Razorpay order ID, or a deterministic policy rule.

---

## 3. Visual Language

- **Canvas & Tone**: Pristine, clean light slate (`#F8F9FA`), creating a calm, high-contrast working environment.
- **Surface Elevation**: Two primary physical layers: Level 0 Canvas (`#F8F9FA`) and Level 1 Content Surfaces (`#FFFFFF`) framed by hairline dividers (`#E4E7EB`).
- **Hierarchy & Scanning**: Strong typographical anchors, scannable key-value pairs, and directional flow badges (`ORIGINAL` $\rightarrow$ `SUPERSEDED BY` $\rightarrow$ `RECOVERED`).
- **Typography Discipline**: High-contrast dark neutrals (`#172033` and `#202020`) for primary UI text and financial numbers; steel slate (`#667085`) for secondary descriptions; monospace font exclusively for technical identifiers, hashes, and timestamps.

---

## 4. Color Tokens

### Canonical Color Token Table

| Token Name | Hex Value | Semantic Role / Description |
| :--- | :--- | :--- |
| `--bg-canvas` | `#F8F9FA` | Dominant page background and outer workspace canvas |
| `--bg-surface` | `#FFFFFF` | Primary card, modal, and panel background surface |
| `--bg-subtle` | `#F1F3F5` | Secondary row fills, input backgrounds, and disabled states |
| `--bg-elevated` | `#FFFFFF` | Floating cards, popovers, and elevated action panels |
| `--text-primary` | `#172033` | Primary headings, titles, active labels, and financial figures |
| `--text-secondary` | `#667085` | Supporting descriptions, property keys, and metadata |
| `--text-muted` | `#98A2B3` | Micro-captions, breadcrumbs, and disabled text |
| `--border-default` | `#E4E7EB` | Structural card borders, dividers, and panel outlines |
| `--border-subtle` | `#F1F3F5` | Internal table row borders and lightweight separators |
| `--accent-primary` | `#0284C7` | Primary action fills, Razorpay rails, and active tab indicators |
| `--accent-hover` | `#0369A1` | Darkened hover state for primary interactive elements |
| `--accent-subtle` | `#EFF6FF` | Subtle background tint for active items and selected filters |
| `--accent-border` | `#BAE6FD` | Hairline border for interactive blue containers |
| `--success` | `#059669` | Authoritative settlement state (`PAID`), Gate PASS indicators |
| `--success-subtle` | `#ECFDF5` | Background fill for verified badges and success banners |
| `--success-border` | `#A7F3D0` | Hairline border for verified badges |
| `--warning` | `#D97706` | Policy escalations, attention states, and uncaptured callbacks |
| `--warning-subtle` | `#FFFBEB` | Background fill for escalation cards and warning badges |
| `--warning-border` | `#FDE68A` | Hairline border for escalation containers |
| `--danger` | `#DC2626` | Stockout failures (`OUT_OF_STOCK`), policy blocks, payment errors |
| `--danger-subtle` | `#FEF2F2` | Background fill for failure badges and blocked items |
| `--danger-border` | `#FECACA` | Hairline border for failure notifications |
| `--ai-purple` | `#7C3AED` | Google Gemini recommendation badge and AI indicator |
| `--ai-purple-subtle` | `#F5F3FF` | Background fill for Gemini status cards |
| `--ai-purple-border` | `#DDD6FE` | Hairline border for AI-related containers |

---

## 5. Typography Tokens

The system utilizes a dual sans-serif strategy with a specialized monospace accent strictly for technical identifiers:
- **Primary Display, UI & Financial Amounts**: `Plus Jakarta Sans` or `Inter`
- **Body & Operations**: `Inter`
- **Technical Identifiers, Hashes & Timestamps**: `JetBrains Mono` or `SFMono-Regular`

> **Financial Amount Rule**: Monetary figures (e.g. `₹4,900`, `₹5,200`, `₹10.45L`) use the **primary UI sans-serif font** at bold weights (`700`/`800`) with tight letter-spacing (`-0.02em`). Monospace is never applied to financial sums to avoid an unpolished terminal aesthetic.

### Typography Scale

| Token | Font Size | Line Height | Weight | Letter Spacing | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--text-display` | `40px` | `1.15` | 700 / 800 | `-0.035em` | Large KPI values and hero metrics |
| `--text-heading-lg`| `28px` | `1.20` | 700 | `-0.025em` | Main section headings and title banners |
| `--text-heading-sm`| `20px` | `1.30` | 650 | `-0.015em` | Card titles and modal headers |
| `--text-subheading`| `16px` | `1.40` | 600 | `-0.010em` | Product names and monetary displays |
| `--text-body` | `14px` | `1.50` | 400 / 500 | `0.000em` | Standard descriptions and timeline items |
| `--text-body-sm` | `13px` | `1.45` | 400 / 500 | `0.000em` | Table rows, property keys, metadata |
| `--text-caption` | `11px` | `1.35` | 600 / 700 | `+0.050em` | Uppercase section labels and pill badges |
| `--text-mono-sm` | `12px` | `1.40` | 500 / 600 | `0.000em` | Transaction IDs, Order IDs, Hashes, Dates |

---

## 6. Spacing Tokens

The spacing architecture follows a strict **4px modular grid**:

```text
--spacing-4:   4px    (Micro gaps, pill padding)
--spacing-8:   8px    (Badge padding, tight element gaps)
--spacing-12: 12px    (Standard component gap, row padding)
--spacing-16: 16px    (Card internal padding - compact)
--spacing-20: 20px    (Card internal padding - standard)
--spacing-24: 24px    (Grid column gaps)
--spacing-28: 28px    (Card padding - large)
--spacing-32: 32px    (Component group separation)
--spacing-40: 40px    (Sub-section vertical gap)
--spacing-48: 48px    (Major section gap)
--spacing-56: 56px    (Section margin)
--spacing-64: 64px    (Layout break)
--spacing-72: 72px    (Hero module breathing room)
--spacing-80: 80px    (Page-level vertical separator)
```

---

## 7. Radius Tokens

All corners are rounded with calibrated, architectural restraint:

```text
--radius-sm:      4px   (Inputs, micro tags, tooltips)
--radius-md:      6px   (Standard buttons, timeline items)
--radius-lg:      8px   (KPI cards, interactive rows)
--radius-card:   10px   (Standard workspace cards)
--radius-card-lg:14px   (Hero recovery container)
--radius-pill:   9999px (Status pills, delta badges)
```

---

## 8. Shadow / Elevation Tokens

Shadows must be subtle and realistic. Avoid high-blur neon glows or deep black drop-shadows.

```text
--shadow-subtle: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
--shadow-card:   0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px 0 rgba(16, 24, 40, 0.04);
--shadow-hover:  0 4px 6px -1px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.04);
--shadow-modal:  0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03);
```

**Usage Rules**:
- **Allowed**: Elevated workspace cards (`--shadow-card`), interactive button hover states (`--shadow-hover`), and modal popups (`--shadow-modal`).
- **Prohibited**: Flat table rows, timeline nodes, status badges, and inline inputs.

---

## 9. Layout System

The dashboard layout utilizes a modern, 2-tier application shell:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP HEADER (Sticky, White, 64px height, Border Bottom #E4E7EB)                         │
├─────────────────────┬──────────────────────────────────────────────────────────────────┤
│ SIDEBAR (240px)     │ PRIMARY WORKSPACE CONTAINER (Max width 1400px, Padding 24px)     │
│ • Brand logo & name │                                                                  │
│ • SVG Navigation    │ 1. Header Action Controls (Run Live Recovery, Safe Escalation)   │
│ • Active indicators │ 2. PRIMARY HERO: Transaction Recovery Result Card                │
│ • Telemetry status: │ 3. Subordinate 10-Step Compact Evidence Stepper                  │
│   - Gemini 2.5      │ 4. Area A: 4 Merchant Economic Benchmark KPI Cards               │
│   - Razorpay rails  │ 5. Area C: Dual-Pane Decision Fact Sheet & Audit Timeline        │
│   - 111 tests green │                                                                  │
└─────────────────────┴──────────────────────────────────────────────────────────────────┘
```

---

## 10. Responsive Rules

- **Desktop Large (≥ 1440px)**: Full dual-pane layout, 4-column KPI grid, 5-column x 2-row horizontal pipeline.
- **Desktop Standard (1200px – 1439px)**: Full sidebar preserved, 4-column KPI grid adapts with flexible minmax (220px).
- **Tablet (900px – 1199px)**: Sidebar remains visible or collapses to compact icons; Area C stacks vertically into Decision Sheet followed by Audit Timeline.
- **Mobile (< 900px)**: Single column stack; critical hero recovery card and final PAID state pinned to the top.

---

## 11. Navigation

- **Sidebar Structure**:
  - Logo Box: 32x32px `#0284C7` with white bold `R`.
  - Brand Title: `Resilient-Agent-Relay` (14px Bold) + `Agent Payments Protocol` (11px Uppercase Muted).
  - Nav Group: `Live Recovery` (Active), `Policies & Mandates`, `Economic Benchmark`, `Audit Ledger`, `Product Catalog` — each paired with a dedicated 16x16px SVG icon.
  - Nav Item Hover: Background `#F8FAFC`, Text `#172033`.
  - Nav Item Active: Background `#EFF6FF`, Text `#0284C7`, Font-weight 600.
  - Telemetry Footer: Pinned at bottom showing live health indicators (`Gemini 2.5 Flash`, `Razorpay Test Rails`, `111/111 Tests Green`).

---

## 12. Buttons

| Button Variant | Background | Text Color | Border | Shadow / Hover |
| :--- | :--- | :--- | :--- | :--- |
| **Primary CTA** | `#0284C7` | `#FFFFFF` | `#0284C7` | Hover: `#0369A1` + `--shadow-subtle` |
| **Warning CTA** | `#D97706` | `#FFFFFF` | `#D97706` | Hover: `#B45309` + `--shadow-subtle` |
| **Secondary Action**| `#FFFFFF` | `#667085` | `#E4E7EB` | Hover: `#F8FAFC` + Text `#172033` |
| **Disabled State** | `#F1F3F5` | `#98A2B3` | `#E4E7EB` | No shadow, cursor `not-allowed` |

---

## 13. Cards

All cards are constructed from **pure white `#FFFFFF`** surfaces with a **1px solid `#E4E7EB` border** and `--radius-card` (10px).

- **Header Row**: 14px bold uppercase category tag + status badge on the right.
- **Padding**: 20px internal padding.
- **Hover Behavior**: Non-clickable cards remain static; clickable cards transition border to `#D0D5DD` with subtle elevation.

---

## 14. KPI Components

Area A displays four authoritative merchant metric cards:

1. **Recovery Rate**: `59.64%` | Subtext: `201 / 337 eligible failures [SYNTHETIC BENCHMARK]`
2. **Simulated GMV Recovered**: `₹10.45L` | Subtext: `GMV Recovery Rate: 63.30% [SYNTHETIC BENCHMARK]`
3. **Unauthorized Transactions**: `0 (0.00%)` (Colored `#059669`) | Subtext: `Target: 0 · 100% Gated Policy Containment`
4. **Engine vs Gemini Latency**: `0.03ms / 1.73s` | Subtext: `0.03ms Policy Engine · 1.73s Gemini 2.5 Flash`

---

## 15. Transaction Recovery Component (Primary Hero Card)

The primary visual centerpiece of the dashboard. It communicates the entire incident narrative in one glance:

- **Top Row**: Section title `AUTONOMOUS TRANSACTION RECOVERY RESULT` on left; Status Pill `PAID ✓` (`badge-green`) on right.
- **Replacement Flow**:
  - **Left (Failed)**: `Original Transaction (Failed)` | `Adidas Boston 12` | `₹4,900` (Sans-serif bold) | Badge: `OUT_OF_STOCK` (Red).
  - **Center (Indicator)**: Badge: `+₹300 (+6.12%)` (Green) + Caption: `↓ SUPERSEDED BY ↓`.
  - **Right (Recovered)**: `Recovered Replacement` | `Adidas Adizero SL2` | `₹5,200` (Sans-serif bold) | Badge: `RECOVERED SUBSTITUTE` (Green).
- **Dual Authority Bar**:
  - `USER AUTHORITY MANDATE`: `Budget: ≤₹5,500 · Brand: Adidas · Delta: ≤10.0%` $\rightarrow$ `PASS ✓`
  - `MERCHANT AUTHORITY POLICY`: `Margin Floor: ≥10.0% · Recovered Margin: 25.0%` $\rightarrow$ `PASS ✓`

---

## 16. Subordinate 10-Step Execution Pipeline

Positioned beneath the hero recovery card as a compact horizontal verification bar:
- Displays all 10 verified financial stages in a tight, scannable grid.
- Each stage features a small status indicator and description (e.g. `Step 08: Webhook HMAC — Raw Body HMAC PASS`).

---

## 17. Authorization / Policy Component

Visualizes the deterministic intersection $UserMandate \cap MerchantPolicy$:
- Displays exact bounds: Max Budget, Max Price Delta Tolerance, Category whitelist, Brand whitelist, Required Attributes (e.g., Size 10).
- Displays Merchant Margin Rule: Minimum gross margin floor enforcement (e.g., 10.0% floor vs 25.0% recovered margin).

---

## 18. Audit Timeline

Formats transaction events as an immutable chronological stream:
- **Left Border**: 3px colored accent (Green for `SUCCESS`, Red for `FAILURE`, Amber for `ESCALATION`).
- **Timestamp**: Monospace text aligned cleanly (`23:10:01`).
- **Event Header**: Event Type (e.g., `PAYMENT_CAPTURED [SUCCESS]`).
- **Event Metadata**: Monospace transaction IDs, Razorpay order IDs, or verified HMAC signature digests.

---

## 19. Status System

| Status Name | Background | Text Color | Border Color | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `PAID` | `#ECFDF5` | `#065F46` | `#A7F3D0` | Webhook verified, funds captured |
| `OUT_OF_STOCK` | `#FEF2F2` | `#991B1B` | `#FECACA` | Runtime inventory failure detected |
| `ESCALATION_REQUIRED`| `#FFFBEB` | `#92400E` | `#FDE68A` | Policy constraint breach; 0 orders created |
| `NEW_ORDER_CREATED` | `#EFF6FF` | `#0369A1` | `#BAE6FD` | Real Razorpay order registered on test rails |
| `AWAITING_WEBHOOK` | `#FFFBEB` | `#92400E` | `#FDE68A` | Client signature verified; pending webhook |

---

## 20. Provenance System

Provenance badges inform judges whether data is live or synthetic:
- `ENVIRONMENT: LIVE TEST MODE`: Badge Green (`#ECFDF5` / `#065F46`)
- `ENVIRONMENT: DEMO FIXTURE`: Badge Yellow (`#FFFBEB` / `#92400E`)
- `PROVENANCE: SYNTHETIC BENCHMARK`: Badge Purple (`#F5F3FF` / `#7C3AED`)

*Rule*: Place provenance badges exclusively in the sticky top header and section title bars. Do not repeat provenance inside individual data cells.

---

## 21. Safe Escalation State

When a test triggers a budget breach (e.g., 1% user tolerance vs +6.12% delta):
- **Hero State**: Replaces `PAID ✓` with `ESCALATION_REQUIRED` (Amber).
- **Banner**: Displays `Safe Escalation Triggered: Candidate exceeded budget tolerance (+6.12% vs 1%). Zero Razorpay orders created.`
- **Pipeline Nodes**: Step 4 turns Amber (`POLICY BLOCKED`), Steps 5–9 turn Muted (`HALTED / NO ORDER CREATED`), Step 10 turns Amber (`ESCALATION REQUIRED`).

---

## 22. Tables / Lists

- Key-value rows use a flex layout with hairline bottom border (`#E4E7EB`).
- Key column: `#667085` font-weight 500.
- Value column: `#172033` font-weight 600 font-family monospace for IDs / sans-serif for prices.

---

## 23. Forms / Inputs

- Background: `#FFFFFF` with 1px border `#E4E7EB`.
- Focus Ring: `0 0 0 3px rgba(2, 132, 199, 0.15)` with border `#0284C7`.
- Padding: 8px 12px; Radius: 6px (`--radius-md`).

---

## 24. Icons (Minimalist SVG System)

The icon system uses standardized, clean **16x16px / 14x14px SVG stroke icons** (`stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`):
- **Recovery / Action**: Lightning bolt SVG (`<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>`)
- **Policy / Security**: Shield SVG (`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`)
- **Benchmark / Metrics**: Bar chart SVG (`<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>`)
- **Audit / Ledger**: Scroll/File SVG (`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>`)
- **Catalog / Products**: Shopping tag SVG (`<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>`)
- **Checkmark / Pass**: Check SVG (`<polyline points="20 6 9 17 4 12"></polyline>`)

---

## 25. Motion

- Transition durations: `150ms` for hover states, `200ms ease-out` for timeline insertion.
- No spinning rainbow borders or distracting ambient loops.

---

## 26. Accessibility

- Text contrast ratios exceed **WCAG 2.1 AA** (Minimum 4.5:1 for body copy on white; > 11:1 for primary headings).
- All interactive controls have distinct hover and active states.
- Status states combine color with explicit text labels (`PAID ✓`, `BLOCKED ✕`).

---

## 27. Do's

1. Do maintain high contrast between text (`#172033`) and canvas (`#F8F9FA`).
2. Do use monospace font strictly for technical identifiers, hashes, and timestamps.
3. Do use primary UI font for monetary amounts (`₹4,900`, `₹5,200`).
4. Do make the original vs substitute replacement contrast immediately visible in the hero card.
5. Do display authoritative settlement only after verified `payment.captured` webhooks.
6. Do use clean SVG outline icons instead of emojis.

---

## 28. Don'ts

1. Do NOT use dark mode, black cards, or neon glows.
2. Do NOT use emoji glyphs in core navigation or action buttons.
3. Do NOT apply monospace font to financial amounts.
4. Do NOT allow the 10-step pipeline to visually overpower the recovery hero card.
5. Do NOT imply AI directly pays or authorizes transactions.
6. Do NOT clutter cards with repetitive duplicate badges.

---

## 29. CSS Variables

```css
:root {
  /* Surface & Canvas */
  --bg-canvas: #F8F9FA;
  --bg-surface: #FFFFFF;
  --bg-subtle: #F1F3F5;
  --bg-elevated: #FFFFFF;
  --border-default: #E4E7EB;
  --border-subtle: #F1F3F5;
  --border-hover: #D0D5DD;

  /* Typography Colors */
  --text-primary: #172033;
  --text-secondary: #667085;
  --text-muted: #98A2B3;

  /* Interactive & Rails */
  --accent-primary: #0284C7;
  --accent-hover: #0369A1;
  --accent-subtle: #EFF6FF;
  --accent-border: #BAE6FD;

  /* Status Colors */
  --success: #059669;
  --success-dark: #065F46;
  --success-subtle: #ECFDF5;
  --success-border: #A7F3D0;

  --warning: #D97706;
  --warning-dark: #92400E;
  --warning-subtle: #FFFBEB;
  --warning-border: #FDE68A;

  --danger: #DC2626;
  --danger-dark: #991B1B;
  --danger-subtle: #FEF2F2;
  --danger-border: #FECACA;

  --ai-purple: #7C3AED;
  --ai-purple-subtle: #F5F3FF;
  --ai-purple-border: #DDD6FE;

  /* Fonts */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-64: 64px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-card: 10px;
  --radius-card-lg: 14px;
  --radius-pill: 9999px;

  /* Elevation */
  --shadow-subtle: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
  --shadow-card: 0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px 0 rgba(16, 24, 40, 0.04);
  --shadow-hover: 0 4px 6px -1px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.04);
}
```

---

## 30. Tailwind v4 Theme

```css
@theme {
  /* Colors */
  --color-canvas: #F8F9FA;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F1F3F5;
  --color-border: #E4E7EB;
  --color-border-subtle: #F1F3F5;
  --color-border-hover: #D0D5DD;

  --color-text-primary: #172033;
  --color-text-secondary: #667085;
  --color-text-muted: #98A2B3;

  --color-accent: #0284C7;
  --color-accent-hover: #0369A1;
  --color-accent-subtle: #EFF6FF;
  --color-accent-border: #BAE6FD;

  --color-success: #059669;
  --color-success-dark: #065F46;
  --color-success-subtle: #ECFDF5;
  --color-success-border: #A7F3D0;

  --color-warning: #D97706;
  --color-warning-dark: #92400E;
  --color-warning-subtle: #FFFBEB;
  --color-warning-border: #FDE68A;

  --color-danger: #DC2626;
  --color-danger-dark: #991B1B;
  --color-danger-subtle: #FEF2F2;
  --color-danger-border: #FECACA;

  --color-ai-purple: #7C3AED;
  --color-ai-purple-subtle: #F5F3FF;
  --color-ai-purple-border: #DDD6FE;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'SFMono-Regular', ui-monospace, Menlo, Monaco, Consolas, monospace;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-card: 10px;
  --radius-card-lg: 14px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-subtle: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
  --shadow-card: 0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px 0 rgba(16, 24, 40, 0.04);
  --shadow-hover: 0 4px 6px -1px rgba(16, 24, 40, 0.08), 0 2px 4px -2px rgba(16, 24, 40, 0.04);
}
```

---

## 31. Dashboard Layout Blueprint

```text
+-------------------------------------------------------------------------------------------------------+
| [R] Resilient-Agent-Relay                     ENVIRONMENT: LIVE TEST MODE | RAZORPAY | GEMINI 2.5 FLASH|
+-------------------+-----------------------------------------------------------------------------------+
| SVG NAVIGATION    | [Run Live Golden Recovery]   [Test Safe Escalation]   [Load Fixture]              |
|                   +-----------------------------------------------------------------------------------+
| ⚡ Live Recovery   | PRIMARY HERO: RECOVERY RESULT CARD                                                |
| 🛡️ Policies       | Adidas Boston 12 (₹4,900) [OUT_OF_STOCK] ---> Adidas Adizero SL2 (₹5,200) [PAID]  |
| 📊 Benchmark      | User Mandate: PASS [DETERMINISTIC]       Merchant Policy: PASS [MARGIN 25%]       |
| 📜 Audit Ledger   +-----------------------------------------------------------------------------------+
| 👟 Catalog        | SUBORDINATE 10-STEP EXECUTION PROGRESS BAR                                        |
|                   | [1. Start] -> [2. Fail] -> [3. AI] -> [4. Policy] -> ... -> [10. State: PAID]     |
| ----------------- +-----------------------------------------------------------------------------------+
| TELEMETRY STATUS  | AREA A: 4 KPI BENCHMARK CARDS                                                     |
| ● Gemini 2.5      | 59.64% Recovery Rate | ₹10.45L GMV | 0 Unauthorized | 0.03ms / 1.73s Latency      |
| ● Razorpay Rails  +-----------------------------------------------------------------------------------+
| ✓ 111 Tests Green | AREA C: DECISION FACT SHEET                  AREA C: IMMUTABLE AUDIT TRAIL        |
|                   | Why this substitute was approved (8 checks)   Chronological event stream with     |
|                   | Key/Value properties table                   timestamps, hashes, and IDs         |
+-------------------+-----------------------------------------------------------------------------------+
```

---

## 32. Visual QA Checklist

- [x] **Light Canvas Integrity**: Entire application sits strictly on `#F8F9FA` with white `#FFFFFF` cards.
- [x] **High-Contrast Typography**: Primary text `#172033` achieves > 11:1 contrast ratio against white.
- [x] **Monospace Exclusivity**: Monospace applied strictly to IDs, order IDs, timestamps, and hashes.
- [x] **Sans-Serif Amounts**: Monetary sums (`₹4,900`, `₹5,200`, `₹10.45L`) rendered in bold UI sans-serif.
- [x] **Hero Narrative Priority**: The failure $\rightarrow$ substitute $\rightarrow$ authorization $\rightarrow$ Razorpay $\rightarrow$ PAID story is the visual centerpiece.
- [x] **Subordinate Pipeline**: 10-step execution stepper is formatted as a compact verification bar.
- [x] **SVG Icon System**: Navigation and action buttons use standardized outline SVGs instead of emojis.
- [x] **Dual Authority Verification**: User mandate and Merchant policy constraints explicitly rendered.
- [x] **4 Benchmark KPIs Labeled**: Area A cards clearly annotated as `[SYNTHETIC BENCHMARK]`.
- [x] **Safe Escalation Tested**: Blocked state correctly displays amber containment cards with 0 orders.
- [x] **Razorpay Standard Checkout**: Real popup modal triggers on live recovery.
- [x] **Zero Secret Leakage**: No API keys or webhook secrets rendered in the DOM.
- [x] **111 / 111 Tests Passing**: Full vitest suite passes with 0 regressions.

---

## Reference Decisions

### ClickUp Contribution
- **Extracted**: Modular light dashboard layout structure, high-density white content cards with hairline gray borders (`#E4E7EB`), compact 10–14px typography hierarchy, and status pill badges.
- **Rejected**: ClickUp's purple/magenta gradient branding, rainbow conic-gradient CTA animation, productivity task management avatars, and marketing landing page hero sections.

### Mercury Contribution
- **Extracted**: Financial design restraint, disciplined 4px spacing rhythm, calm surface hierarchy, measured typography weight calibration (preventing heavy bold noise), and technical monospace data display.
- **Rejected**: Mercury's dark `#171721` onyx canvas, dark graphite card system, dark banking photography, and cobalt brand identity.

### Project-Specific Decisions
- **Synthesized**: Created the **Light FinTech Transaction Control Plane** tailored specifically for autonomous agentic payment recovery.
- **Core Architecture**: Centered around the 4-part truth: *AI recommends. Policy authorizes. Razorpay executes. Audit proves.*
- **Color System**: Curated an authoritative palette featuring Razorpay Blue (`#0284C7`), Emerald Settlement Green (`#059669`), Warning Amber (`#D97706`), and Gemini Violet (`#7C3AED`) on a clean `#F8F9FA` canvas.
