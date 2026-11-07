---
name: Classroom Monitor
description: Neutral SaaS Operate dashboard for truthful classroom monitoring.
colors:
  background: "#f7f8fa"
  panel: "#fff"
  foreground: "#202b32"
  muted: "#6c7680"
  border: "#e5e9ec"
  accent: "#237a57"
  accent-soft: "#edf6f0"
  sidebar: "#fff"
  dark-background: "#121917"
  dark-panel: "#1a2320"
  dark-foreground: "#e4ece7"
  dark-muted: "#a1b0a7"
  dark-border: "#303d35"
  dark-accent: "#74c69c"
  dark-accent-soft: "#233e30"
  dark-sidebar: "#17201b"
  primary-button: "#277c56"
  primary-button-hover: "#1d6545"
  normal: "#26764e"
  normal-surface: "#edf7f0"
  warning: "#936214"
  warning-surface: "#fff5de"
  danger: "#b33d3d"
  danger-surface: "#fff0ee"
  dark-normal: "#91d2a7"
  dark-normal-surface: "#213e2b"
  dark-warning: "#f0cc82"
  dark-warning-surface: "#43351c"
  dark-danger: "#f3a9a2"
  dark-danger-surface: "#442723"
  status-dot: "#90999f"
  normal-dot: "#34895d"
  warning-dot: "#bb8b2f"
  danger-dot: "#c65050"
  temperature-chart: "#278461"
  humidity-chart: "#5089a5"
typography:
  body:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  headline:
    fontSize: "27px"
    fontWeight: 650
    letterSpacing: "-0.8px"
  title:
    fontSize: "14px"
    fontWeight: 620
  metric:
    fontSize: "39px"
    fontWeight: 550
    lineHeight: 1.4
    letterSpacing: "-1.5px"
  button:
    fontSize: "12px"
    fontWeight: 500
  badge:
    fontSize: "10px"
    fontWeight: 500
  mono:
    fontFamily: "var(--font-geist-mono), monospace"
rounded:
  badge: "5px"
  control: "6px"
  event: "7px"
  strip: "8px"
  panel: "9px"
  brand: "10px"
spacing:
  tight: "4px"
  icon: "8px"
  compact: "12px"
  medium: "16px"
  panel: "22px"
  section: "24px"
  page-top: "32px"
  page-inline: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary-button}"
    textColor: "{colors.panel}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-button-hover}"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  badge-normal:
    backgroundColor: "{colors.normal-surface}"
    textColor: "{colors.normal}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    height: "42px"
    padding: "0 13px"
---

# Design System: Classroom Monitor

## Overview

**Creative North Star: "Quiet classroom operations"**

The user-pinned neutral SaaS Operate dashboard prioritizes current readings, freshness, and explicit status. Compact typography, bordered surfaces, and restrained green accents create a practical workspace. The implemented light foundation has a dark theme with the same hierarchy and green/amber/red/gray state meanings.

**Key Characteristics:**
- Compact, calm, data-first hierarchy.
- Color-plus-text states and honest unavailable readings.
- Responsive navigation and single-column phone reading order.

Source of truth: `app/globals.css` and `components/monitor-app.tsx`; direction: `docs/dashboard-direction.md`. Finish reviewer disposition: **ship** (supplied review outcome). Review evidence: `.impeccable/review/desktop.png` and `.impeccable/review/mobile.png`. These are documentation artifacts, not shipping raster assets; the interface uses CSS, SVG charts, and Lucide icons.

## Colors

Primary green identifies actions, active navigation, and links. Normal green, warning amber, danger red, and muted gray convey operational state through text as well as tint. Neutral ground, panel, text, divider, and sidebar primitives map directly to the matching CSS custom properties. `data-theme="dark"` replaces these eight primitives with their `dark-` counterparts and enables `color-scheme: dark`; severity surfaces also receive explicit dark overrides. Primary buttons retain their green fill and white text in both themes.

**The Truthful State Rule.** Gray means unavailable, offline, or neutral—not healthy. Temperature is normal at ≤32°C, warning above 32°C through 35°C, and danger above 35°C. Sensor errors suppress current temperature and humidity values. Motion is a PIR signal, not attendance.

Temperature and humidity chart colors distinguish series, not severity. Blue also identifies the physical motion LED; it is not an additional alert level.

## Typography

Geist Sans supplies interface text; Geist Mono is reserved for device identifiers. Use the frontmatter hierarchy for headings, metric values, controls, and badges. Paragraphs use line-height 1.6. Supporting copy is typically 10–12px; navigation is 12px; table text is 11px. Desktop threshold labels are 8px (7px at the intermediate breakpoint), returning to 9px on phones.

Metric values, statistics, and table cells use tabular numerals. Units are quieter, with 17px regular-weight text beside the primary metric. Main headings become 23px on phones; metric figures become 33px at ≤900px and 37px at ≤700px. Avoid using the login's larger editorial heading scale for operational screens.

## Layout

The fixed sidebar is 236px wide, manually collapsible to 76px. A 74px header sits above a centered content area capped at 1550px, with padding `32px 36px 20px`. Three equal sensor columns use a 19px gap; the overview uses `minmax(0, 1.8fr) minmax(280px, 1fr)` with a 22px gap. Analytics uses two equal columns. Panel headings use `21px 22px 17px`; metric cards use `21px 22px` and a 199px minimum height.

- **≥1500px:** content top padding 40px, metric minimum height 215px, chart height 260px.
- **≤1150px:** sidebar 210px, content padding `26px 24px`, sensor gap 14px, overview ratio 1.4:1 with 260px minimum secondary column.
- **≤900px:** icon rail 76px, sensor gap 12px, overview ratio 1.5:1 with 240px minimum secondary column and 16px gap; device details stack.
- **≤700px:** sidebar hidden until opened as a 236px drawer over a backdrop; main offset removed, header 62px, content padding `24px 18px`. Sensor, overview, and statistics grids become one column. Metrics use 19px padding and no minimum height. Toolbars and pagination wrap. Tables scroll horizontally within their own container.

Preserve DOM reading order: status, sensor readings, chart, device connectivity, activity, hardware. Desktop chart height is 225px; phone chart height is 230px.

## Elevation & Depth

Flat panels use one-pixel borders and tonal separation. Only the account popover (`0 8px 25px #00000010`) and selected alert filter (`0 1px 3px #00000009`) use shadows. The mobile backdrop is `#0005`; drawer/backdrop layers are 30/25 and the account popover is 50. No decorative gradients or raster textures are required.

## Shapes

Use gently rounded rectangular controls, compact badges, and bordered panels according to the frontmatter radii. Dots, LEDs, and account initials are circular. Status dots are 6px; hardware LEDs are 9px with a 2px rim. Dividers separate panel footers, detail rows, and history rows without additional nested cards.

## Components

- **Buttons:** primary, outline, and ghost variants share an 8px icon gap and 37px minimum height. Outline/ghost hover uses the background primitive; primary hover uses its darker fill. Icon buttons are 36px wide with 8px padding. Disabled buttons use opacity 0.45 and `not-allowed` cursor.
- **Status:** badges pair a dot with visible, capitalized text. The condition strip uses the same severity families, a `currentColor` border mixed to 13% opacity, and an explanatory sentence. Offline and sensor-error states retain explicit wording; unavailable values use an em dash.
- **Panels:** semantic sections with h2 titles, optional explanatory text and action. Cards remain flat. Empty states use an icon, “No data yet,” and contextual guidance rather than invented readings.
- **Fields:** native inputs/selects use one-pixel borders, panel backgrounds, and accent carets. Visible wrapping labels define form fields; compact period selects have accessible names. Settings communicate browser-local persistence and read-only thresholds.
- **Navigation:** links carry icons, labels, `title`, and `aria-current="page"`; active links use accent-soft fill and accent text. Hover uses neutral ground. Account actions use native details/summary. Alert filters are buttons with `aria-pressed`, not navigation tabs.
- **Charts and history:** SVG area charts use 2px strokes, 0.07 fill opacity, dashed horizontal grid lines, and no animation; invalid readings create gaps. Accessible chart descriptions point to the history table. Device metadata uses definition lists; history uses semantic tables.
- **Accessibility and motion:** preserve the skip link to main content, named icon actions, visible labels, `role="alert"` errors, and `role="status"` save feedback. Focus-visible uses a 2px accent outline with 4px offset. Links/buttons transition background and color over 0.15s; reduced-motion disables transitions and animations. Status text must remain understandable without color. This records implemented conventions, not a claim of a separate accessibility certification.

## Do's and Don'ts

### Do:
- **Do** preserve color-plus-text status, units, and freshness context.
- **Do** use theme primitives for surfaces, text, borders, and navigation.
- **Do** retain keyboard focus, semantic controls, and phone reading order.
- **Do** distinguish unavailable readings from zero.

### Don't:
- **Don't** turn PIR motion into attendance or imply humidity alert thresholds.
- **Don't** add decorative raster assets, heavy card shadows, or gradients to this operational interface.
- **Don't** promote review screenshots into shipping assets.
- **Don't** use color alone to communicate severity or connection state.
