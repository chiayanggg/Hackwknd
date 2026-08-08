# Smart City AI Planning Simulator — Prototype

Lightweight prototype of the digital twin concept from the project doc. Schematic SVG junction
instead of 3D map (no Three.js/OSM/Mapbox), rule-based mock AI instead of a live Gemini call
(no API key needed). Rule engine formulas (traffic, cost, CO2, accidents) follow section 7 of
the doc.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL.

## What's real vs mocked

- **Real**: time-of-day traffic model (AM/Mid/PM/Night multipliers), roundabout vs signals delay
  logic, cost/construction-time JSON, CO2/accident/population formulas, Professional vs Sandbox
  mode, Before/After comparison.
- **Mocked**: `src/lib/mockAI.ts` stands in for the `/api/analyze` Gemini call — templated text
  driven by the same rule-engine numbers, not an actual LLM call. Swap in a real `fetch` to
  Gemini there when ready (key goes in `.env.local`).
- **Simplified**: one fixed T-junction (`src/data/baseline.ts`) instead of a full OSM-loaded KL
  district; SVG scene instead of 3D buildings/roads.

## Structure

- `src/types.ts` — data model
- `src/lib/ruleEngine.ts` — traffic/congestion formulas per time period
- `src/lib/costEngine.ts` — cost, CO2, accident, population formulas
- `src/lib/mockAI.ts` — mock recommendation generator
- `src/components/` — UI (tool palette, time selector, KPI cards, before/after, junction scene)
