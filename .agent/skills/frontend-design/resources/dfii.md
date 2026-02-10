# Design Feasibility & Impact Index (DFII)

Score each dimension 1–5 before committing to a design direction.

## Dimensions

| Dimension                      | Question                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| **Aesthetic Impact**           | How visually distinctive and memorable is this direction?    |
| **Context Fit**                | Does this aesthetic suit the product, audience, and purpose? |
| **Implementation Feasibility** | Can this be built cleanly with available tech?               |
| **Performance Safety**         | Will it remain fast and accessible?                          |
| **Consistency Risk**           | Can this be maintained across screens/components?            |

## Formula

```
DFII = (Impact + Fit + Feasibility + Performance) − Consistency Risk
```

**Range:** −5 → +15

## Interpretation

| DFII      | Verdict   | Action                      |
| --------- | --------- | --------------------------- |
| **12–15** | Excellent | Execute fully               |
| **8–11**  | Strong    | Proceed with discipline     |
| **4–7**   | Risky     | Reduce scope or effects     |
| **≤ 3**   | Weak      | Rethink aesthetic direction |

## Example

> **Direction:** Industrial-utilitarian dashboard
>
> - Impact: 4 — strong departure from SaaS norms
> - Fit: 5 — matches financial tooling audience
> - Feasibility: 4 — monospace type + sparse layout = straightforward
> - Performance: 5 — minimal animation, light assets
> - Consistency Risk: 2 — systematic grid + limited palette
>
> **DFII = (4 + 5 + 4 + 5) − 2 = 16** → Excellent, execute fully
