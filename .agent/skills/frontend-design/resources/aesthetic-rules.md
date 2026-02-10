# Aesthetic Execution Rules

These rules are **non-negotiable**. Every frontend output must comply.

---

## Typography

- **Avoid:** System fonts and AI-defaults (Inter, Roboto, Arial, Helvetica, etc.)
- **Choose:** 1 expressive display font + 1 restrained body font
- **Use typography structurally:** Scale, rhythm, and contrast are layout tools — not afterthoughts

### Font Pairing Examples

| Display (Expressive) | Body (Restrained) | Pairing Tone         |
| -------------------- | ----------------- | -------------------- |
| Space Grotesk        | IBM Plex Sans     | Industrial precision |
| Playfair Display     | Source Sans 3     | Editorial elegance   |
| Syne                 | Work Sans         | Retro-futuristic     |
| DM Serif Display     | DM Sans           | Refined warmth       |
| Archivo Black        | Archivo           | Bold utilitarian     |
| Fraunces             | Outfit            | Organic luxury       |

---

## Color & Theme

- **Commit** to a dominant color story — not an even palette
- **Use CSS variables exclusively** for all color values
- **Structure:**
  - One **dominant** tone (60%)
  - One **accent** (10–15%)
  - One **neutral system** (25–30%)
- **Avoid:** Evenly-balanced palettes, generic blue/purple SaaS gradients

### CSS Variable Pattern

```css
:root {
  /* Dominant */
  --color-surface: #0a0a0f;
  --color-surface-elevated: #14141f;

  /* Accent */
  --color-accent: #e8c547;
  --color-accent-muted: #e8c54733;

  /* Neutral */
  --color-text-primary: #f0f0f0;
  --color-text-secondary: #888;
  --color-border: #ffffff12;
}
```

---

## Spatial Composition

- **Break the grid intentionally** — predictable grids = forgettable layouts
- Use at least one of:
  - **Asymmetry** — unequal column ratios, offset elements
  - **Overlap** — layered elements breaking containment
  - **Negative space** — emptiness as a design element, not absence
  - **Controlled density** — intentional information clustering
- White space is not nothing — it's a compositional tool

---

## Motion

Motion must be:

- **Purposeful** — communicates state or draws attention
- **Sparse** — few, impactful animations > many small ones
- **High-impact** — if it moves, it should matter

### Motion Budget

| Type                    | Allowed Count | Use For                              |
| ----------------------- | ------------- | ------------------------------------ |
| Entrance sequence       | 1 per view    | Page load, section reveal            |
| Hover states            | ≤5 per view   | Interactive elements, navigation     |
| Transition animations   | As needed     | Route changes, modal open/close      |
| Decorative micro-motion | 0             | **Never.** No shimmer, pulse, float. |

### Timing Guidelines

```css
/* Functional transitions */
--duration-fast: 120ms; /* hover, toggle */
--duration-medium: 250ms; /* expand, collapse */
--duration-slow: 500ms; /* entrance, page transition */

/* Always use easing */
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

---

## Texture & Depth

Use **when appropriate** to reinforce the aesthetic thesis:

| Technique               | When to Use                            | When to Skip                |
| ----------------------- | -------------------------------------- | --------------------------- |
| Noise / grain overlays  | Dark UIs, brutalist, editorial         | Clean minimalism, luxury    |
| Gradient meshes         | Hero sections, backgrounds             | Data-dense dashboards       |
| Layered translucency    | Glassmorphism, depth hierarchy         | Already-complex layouts     |
| Custom borders/dividers | Utilitarian, magazine layouts          | When standard lines suffice |
| Narrative shadows       | Floating elements, cards with presence | Flat design directions      |

> **Rule:** Shadows should tell a story about spatial relationships — never use `box-shadow: 0 2px 4px rgba(0,0,0,.1)` as a default.
