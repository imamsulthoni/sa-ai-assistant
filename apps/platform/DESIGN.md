# Design System: Halodocs Platform

<!-- impeccable:design-schema 1 -->

## Visual World & Metaphor
**Instrument panel, two lights.** Halodocs is a requirements instrument: quiet surfaces, hairline rules, square corners, and one signal color that means *action, selected, or verified* — nothing else. Light is the default world (slate ground, white panels, indigo signal). Dark keeps the identical structure on graphite (obsidian ground, olive-charcoal rules, lime signal). Both themes are one system; a component authored against tokens ships in both without per-theme values.

## Color Tokens
Defined in `src/styles.css` as CSS custom properties consumed by Tailwind utilities (`bg-card`, `border-input`, `text-muted-foreground`, `bg-overlay`, `ring-ring`). No component hardcodes a theme pair.

| Role | Light | Dark |
|---|---|---|
| background | `#f8fafc` | `#10110f` |
| card / popover | `#ffffff` | `#151713` |
| foreground | `#0f172a` | `#f2f0e9` |
| muted | `#f1f5f9` | `#1d211a` |
| muted-foreground | `#64748b` | `#a7aaa0` |
| border | `#e2e8f0` | `#30332d` |
| input | `#cbd5e1` | `#3a3e35` |
| primary (signal) | `#4f46e5` | `#d9fa54` |
| primary-foreground | `#ffffff` | `#10110f` |
| accent (selected) | `#eef2ff` / `#4338ca` | `#252b1c` / `#d9fa54` |
| success / verified | `#047857` on `#f0fdf4` | `#d9fa54` on `#10110f` |
| destructive | `#e11d48` on `#fff1f2` | `#fb7185` on `#2a0a14` |
| warning | `#b45309` on `#fffbeb` | `#fbbf24` on `#241704` |
| info | `#0369a1` on `#f0f9ff` | `#38bdf8` on `#06283a` |
| diff added | `#ecfdf5` / `#047857` | `#1a2718` / `#bce675` |
| diff removed | `#fff1f2` / `#be123c` | `#321b22` / `#f69aa7` |
| overlay scrim | `rgb(15 23 42 / 55%)` | `rgb(0 0 0 / 70%)` |

Dark accents are bright-on-dark with dark foreground text (signal-bg logic), not dark-on-dark tints.

## Geometry & Elevation
- **Radius is square by contract**: `--radius-sm` through `--radius-3xl` are `0px`. `rounded-full` stays round and is reserved for avatars, status dots, and toggle tracks — never for containers, buttons, or inputs.
- **Elevation is declared once, with a border**: `--shadow-soft` and `--shadow-lifted` are `none`. Shadows belong only to true overlays (modal, dropdown, toast), which keep Tailwind's own shadow utilities.
- Panels separate by 1px `border-border`; hover state changes border color or background fill, never adds a shadow.

## Typography
- **Display**: Plus Jakarta Sans Variable. Tracking `-0.03em` (h1) and `-0.02em` (h2/h3); floor is `-0.04em`. Solid color, never gradient.
- **Body / UI**: Inter Variable. This is the voice for labels, navigation, buttons, and prose.
- **Mono is a role, not a texture**: `--font-mono` is used only for identifiers, status codes, diffs, BDD criteria (Given/When/Then), measurements, and file names. If a label would read fine in Inter, it is Inter.

## Components
- **Button** (`components/base/button.tsx`)
  - `solid` is monochrome ink (`bg-foreground text-background`) — it inverts per theme and never competes with the signal.
  - `outline` = card surface + `border-input`; `ghost` = muted text with a muted hover fill.
  - `danger` / `success` use the status tokens; in dark, success is the lime signal (approved state and primary action share the hue; form distinguishes them).
  - Sizes `sm`/`md` are dense (`h-7`/`h-8`, 12px, semibold), `icon`/`icon-sm` are square. Focus ring is `ring-ring/40`.
- **Input / Textarea**: `border-input` on `bg-card`, focus moves to `ring` color, caret in `primary` (inherited from base). Placeholder uses `muted-foreground`.
- **Modal**: `bg-overlay` scrim with blur; panel is `bg-card` + `border-border` + `shadow-2xl`; header and footer use `bg-muted`.
- **Badge**: tone families derive from status tokens (`success`, `warning`, `danger`, `info`); alias tones (`emerald`, `amber`, `sky`) map onto the same three families; `dark` tone is an ink chip.
- **Alert**: status-token border/background/text at 30/10/100 strength.
- **Skeleton**: `bg-foreground/10`, theme-agnostic.

## Browser Surfaces
- Selection tints `primary` at 25%; caret uses `primary`.
- Scrollbars: thin, thumb `foreground` at 22%, hover 35%, transparent track (WebKit + Firefox).
- `:focus-visible` gets a 2px `ring` outline with 2px offset globally; components may opt into their own ring instead.

## Interactive Principles
- **Signal discipline**: indigo (light) or lime (dark) marks action, selection, and verified state. It is never decoration, and it never fills large regions.
- **Border-first hierarchy**: structure comes from 1px rules and surface contrast, not from stacked shadows.
- **No generic card wall**: one proof artifact plus structured rows beats equal-weight tiles.
- **Audit-first state feedback**: explicit questions, status labels, diff previews, and human approval stay visible.
- **Theme parity**: both themes ship the same hierarchy; a component that only works in one theme is unfinished.
- **The public landing surface** (Persuade mode) uses the same tokens on a `.landing-shell` scope so the preview matches the product it promises.
