# Smart City AI Planning Simulator

Real 3D digital twin of a Kuala Lumpur street intersection (Jalan Tun Razak / Jalan Ampang),
built on live OpenStreetMap road and building data. Edit the road network and buildings,
watch traffic (with real vehicle routing, traffic lights, and collision avoidance) respond.

## Setup — for teammates

**1. Install Node.js**
Get the LTS version from [nodejs.org](https://nodejs.org) (v18 or newer). This also installs `npm`.
Check it worked:
```bash
node -v
npm -v
```

**2. Get the code**

If you don't have git: install it from [git-scm.com](https://git-scm.com), or just download the
repo as a ZIP from GitHub (green "Code" button → Download ZIP) and skip to step 3.

```bash
git clone https://github.com/chiayanggg/Hackwknd.git
cd Hackwknd
```

**3. Install dependencies**
```bash
npm install
```
Takes a minute or two the first time.

**4. Run it**
```bash
npm run dev
```
Terminal prints a URL, usually `http://localhost:5173`. Open that in your browser (Chrome/Edge —
needs WebGL).

**5. Stop it**
`Ctrl+C` in the terminal.

That's it — no API keys or accounts needed to run and use the app as-is.

### If something looks off

- **Blank or tiny 3D view**: hard refresh (`Ctrl+Shift+R`). Occasionally the 3D canvas doesn't
  pick up its size on first paint.
- **Header says "offline fallback layout" instead of "live OSM data"**: normal — the app fetches
  real road/building data from a free public API (Overpass) on every load, which sometimes
  rate-limits after repeated reloads. It falls back to a small built-in layout so the app never
  breaks; just wait a minute and refresh again for the live data.
- **Port already in use**: something else is on 5173. Either close it, or run
  `npm run dev -- --port 5174` and use that port instead.

## How to use it

- **Toolbox** (left) — click a tool, then click where it goes: road tools (roundabout, widen,
  traffic lights, bus lane) need a road/junction click; buildings (apartments, park, EV charger,
  school, hospital, lake) go anywhere on open ground.
- **Time-of-day** (top) — AM/Midday/PM/Night switch the traffic multipliers; watch congestion
  colors and car density change.
- **Mode toggle** (top right) — Professional Planner gives formal cost/KPI numbers; Sandbox
  unlocks extra tools (school/hospital/lake) and short reaction-style feedback instead.
- **Report** (right panel) — full KPI breakdown and before/after comparison.
- Click a placed building again to demolish it. "Reset city to baseline" clears everything.

## What's real vs. simplified

- **Real**: live road/building geometry from OpenStreetMap; per-road capacity/congestion/speed
  by time-of-day; vehicles actually route through the road network, stop at red lights (real
  phase cycling with braking physics), and keep a following distance from the car ahead;
  roundabout entries use a yield-gate model; cost/CO2/accident/population formulas.
- **Mocked**: `src/lib/mockAI.ts` stands in for a live Gemini call — templated text driven by the
  same rule-engine numbers, not an actual LLM. A Gemini API key is wired for later (ask for it if
  you need it) but not called yet, since this is a client-only app and calling Gemini directly
  from the browser would expose the key in the bundle.
- **Procedural, not hand-modeled**: buildings/street props use real `.glb` models where provided
  (`public/models/`); anything without a model yet falls back to simple colored geometry.

## Project structure

```
src/
  lib/
    osm.ts          fetch + parse real OSM data (Overpass), offline fallback
    ruleEngine.ts    per-road traffic/congestion formulas by time-of-day
    costEngine.ts    cost, CO2, accident, population formulas
    traffic.ts       signal phase cycling, roundabout gates, road adjacency
    mockAI.ts        mock recommendation generator
    models.ts        .glb asset registry + scale/orientation tuning
  components/
    CityScene.tsx    the 3D scene (Three.js / React Three Fiber) — roads, buildings,
                     vehicles, traffic lights, click-to-place editing
    icons.tsx        SVG icon set (no emoji anywhere in the UI)
    HudBar.tsx, Toolbox.tsx, TimeOfDaySelector.tsx, RecommendationPanel.tsx,
    KpiCards.tsx, BeforeAfter.tsx, ModeToggle.tsx    UI panels
public/models/        real .glb assets (vehicles, trees, buildings, park props, EV charger)
```
