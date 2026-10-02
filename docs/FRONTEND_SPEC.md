# FRONTEND_SPEC.md

Frontend Design, UX Rules, and Constraints

## DESIGN PRINCIPLES

- Clean, premium, restrained, practical
- Responsive (mobile-first considerations), accessible, low-end friendly
- Avoid: generic SaaS template excess, excessive glassmorphism/gradients/pills, unnecessary rounded cards, giant decorative sections, expensive animations, AI-slop visuals


## RULES

- Backend is source of truth for all business data and calculations
- No fake dashboard data, no fake payment success, no fake AI output
- No frontend accounting engine
- Follow typed contracts from FRONTEND_HANDOFF.md strictly
- Render INSUFFICIENT_DATA states honestly with appropriate empty states
- Never fabricate metrics when data insufficient


## STRUCTURE

- AppShell, navigation, onboarding, POS, products, inventory, finance, reports, AI, ML, offline, subscription as per current implementation
- Use existing UI primitives; extend only as needed per phase



## PADUPOS VISUAL LANGUAGE

**Inspiration:** Sasha Martynchuk (https://www.sashamartynchuk.com/) — editorial, typography-driven, minimal, motion-focused. Reference is inspiration only; PADUPOS does not copy branding/assets/content/layout.

### Visual Principles
- Editorial restraint, typography-first hierarchy, generous whitespace, intentional composition
- Content determines composition; never template-driven
- Functional over decorative; motion must serve clarity/usability
- Premium simplicity with business pragmatism
- Avoid AI-slop, excessive rounding/cards, gradients/glassmorphism, decorative blobs, fake futuristic UI

### Motion Language
- Intentional, smooth, controlled, editorial. Animate to reveal/change context/emphasize, never everything
- Preferred: fade+translate, masked text reveals, staggered reveals, subtle scale, opacity, section transitions
- Avoid: bouncing, excessive springs, spinning, floating, heavy parallax, aggressive 3D, infinite loops
- Respect prefers-reduced-motion; disable non-essential animation when enabled
- Lightweight (CSS transforms/opacity), no continuous heavy loops, optimize for low-end devices


### Typography
- Strong hierarchy (display/heading/subheading/body/caption/metric). Use tabular numbers for business metrics
- Large for introductions/metrics/major transitions; compact for tables/controls/metadata
- Line lengths controlled; hierarchy over decoration

### Color System
- Neutral/slate foundation, restrained palette. Functional: success (green), error (red), warning (amber), info (blue). No decoration-only colors. Consistent across all modules.

### Layout & Composition
- Multiple patterns by purpose: editorial dashboard, data workspace, POS workspace, insight page, finance page. Avoid forcing every page into identical card grid.
- Scroll: section progression where meaningful; POS/checkout remain fast/direct

### Page-Specific Motion Guidelines
- Dashboard: primary metric first, supporting follow, charts smooth
- Insights: headline  evidence  insight  recommendation
- Forecast: value  range  chart progressively
- Reports: summary first, stable filters, subtle transitions
- Products: fast, minimal motion, focus states
- POS: extremely restrained, prioritize speed
- Finance: data-first, subtle reveals

### Micro-Interactions & Performance
- Buttons/inputs/tables/navigation/dialogs/toasts refined with subtle transitions, accessible focus
- Low-end optimization: avoid heavy WebGL/canvas loops, prefer transforms/opacity, lazy-load heavy visuals
- No sacrifice of usability for effects


### Design Tokens
- Typography: display, heading, subheading, body, caption, metric
- Spacing: xs, sm, md, lg, xl, 2xl, section
- Radius: small, medium, large (use sparingly)
- Motion: duration-fast/normal/slow; easing-standard/easing-emphasis
- Color: background, foreground, muted, border, accent, success, warning, danger, info (minimal set)

### Brand Identity
- Intelligent, professional, confident, modern, practical, calm, data-driven
- Communicates 'serious business software that understands your business' (not futuristic AI demo)
- Recognizable via interface DNA (typography/spacing/composition/motion/tone), not logo overload


## PADUPOS UNIFIED BRAND EXPERIENCE

**One Design Language:** Public (landing/features/pricing), Auth (login/register/onboarding), App (all modules) share same typography, spacing, colors, borders, radius, buttons, transitions, motion, states, forms, tables, responsive behavior. Visual intensity differs by context; identity is recognizably PADUPOS.

**Continuity Landing  App:** Same visual DNA/easing/motion philosophy; landing more editorial/spacious/storytelling; app more functional/task-oriented/information-dense. Transitions feel like same product.

**Experience Philosophy:** Design for usefulness  fast task completion, low cognitive load, predictability, clear feedback, satisfying interactions, visible progress, minimal friction, trust. No dark patterns/manipulative engagement. Habit-forming comes from usefulness.

**Information Architecture:** Progressive disclosure (primary result  supporting  trend/evidence  insight  detail). Answer daily questions immediately (today's activity, low stock, performance, changes, forecasts, checkout speed).

**Motion Continuity:** Landing expressive with section reveals; app restrained/interaction-focused using shared timing/easing. Motion communicates state/hierarchy/feedback, never decoration.

**Comfort & Consistency:** Calm, in control, informed, not overwhelmed. Avoid visual noise/excessive alerts/badges/competing primaries/excessive motion/crowded cards. Every feature references this spec; no new visual style per feature.

**Responsive & Performance:** Context-aware responsive across desktop/tablet/mobile. Landing lazy-loads non-critical; app lightweight surfaces. Respect prefers-reduced-motion. Optimize for low-end devices; no usability sacrifice.

**Brand Memory:** Recognizable by interface DNA (typography, spacing, composition, restrained color, subtle motion, data presentation, controls, microcopy), minimal logo reliance.

