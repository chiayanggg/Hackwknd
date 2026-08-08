import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Clone } from '@react-three/drei';
import * as THREE from 'three';
import type { CityEdits, DistrictData, EdgeMetrics, NodeEdit, RoadEdge, RoadNode } from '../types';
import type { ToolDef } from '../data/tools';
import { PLOT_ICON } from '../data/tools';
import { buildCenterline, buildEdgeLines, buildRoadRibbon, pointAtT } from '../lib/roadGeometry';
import { polygonCentroid } from '../lib/geo';
import {
  BUILDING_TYPE_MODEL,
  CAR_MODEL_KEYS,
  CITY_BUILDING_KEYS,
  MODEL_SCALE,
  MODEL_URLS,
  MODEL_YAW_OFFSET,
  TREE_MODEL_KEYS,
} from '../lib/models';
import {
  buildAdjacency,
  buildRoundaboutArc,
  computeApproachGroups,
  junctionApproaches,
  junctionControlsThisApproach,
  roundaboutRadius,
  signalColor,
  STOP_LINE_DISTANCE_M,
  type ApproachGroups,
} from '../lib/traffic';
import { congestionColor } from '../lib/ruleEngine';
import { computeSkyState } from '../lib/daynight';
import { IconWarning } from './icons';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface Props {
  district: DistrictData;
  edits: CityEdits;
  metrics: Map<string, EdgeMetrics>;
  hour: number;
  armedTool: ToolDef | null;
  onPlaceNode: (nodeId: number) => void;
  onPlaceEdge: (edgeId: string) => void;
  onPlaceGround: (x: number, z: number) => void;
  onRemoveItem: (itemId: string) => void;
  accessibilityEnabled: boolean;
  accessibilityRoute: 'most-accessible' | 'balanced' | 'direct';
}

const LANE_WIDTH = 3.4;
const SIDEWALK_WIDTH = 2.4; // each side
const ITEM_COLORS: Record<string, string> = {
  apartments: '#818cf8',
  park: '#22c55e',
  evStation: '#38bdf8',
  school: '#fbbf24',
  hospital: '#f87171',
  lake: '#0ea5e9',
};

function hash(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function Road({ edge, edits, metric, armedTool, onPlace }: { edge: RoadEdge; edits: CityEdits; metric: EdgeMetrics | undefined; armedTool: ToolDef | null; onPlace: (id: string) => void }) {
  const edit = edits.edgeEdits[edge.id];
  const lanes = Math.max(1, edge.baseLanes + (edit?.widenCount ?? 0));
  const width = lanes * LANE_WIDTH;
  const sidewalkSpan = width + SIDEWALK_WIDTH * 2;
  const geometry = useMemo(() => buildRoadRibbon(edge.points, width), [edge.points, width]);
  const sidewalkGeometry = useMemo(() => buildRoadRibbon(edge.points, sidewalkSpan), [edge.points, sidewalkSpan]);
  const color = congestionColor(metric?.congestion ?? 0);
  const acceptable = armedTool?.target === 'edge';

  const centerline = useMemo(() => {
    const geom = buildCenterline(edge.points, 0.15);
    const mat = new THREE.LineDashedMaterial({ color: '#f8fafc', dashSize: 3.2, gapSize: 2.6, transparent: true, opacity: 0.5 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    return line;
  }, [edge.points]);

  const curbs = useMemo(() => {
    const { left, right } = buildEdgeLines(edge.points, width, 0.1);
    const mat = new THREE.LineBasicMaterial({ color: '#78716c' });
    return [new THREE.Line(left, mat), new THREE.Line(right, mat.clone())];
  }, [edge.points, width]);

  // A tiny, per-edge, deterministic height offset. Two roads that geometrically overlap
  // (e.g. the two carriageways of a divided road running close together) would otherwise
  // sit at the exact same Y and z-fight — flicker as the renderer can't decide which
  // coplanar surface is "on top". This is way below what's visible from normal camera
  // distance but enough to give the depth buffer a real answer.
  const yJitter = hash(edge.wayId * 7.13) * 0.006;

  return (
    <group>
      {/* sidewalk — a wider, lighter ribbon under the asphalt; only its outer margin ends up visible */}
      <mesh geometry={sidewalkGeometry} position={[0, -0.01 + yJitter, 0]}>
        <meshStandardMaterial color="#8a8580" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        geometry={geometry}
        position={[0, yJitter, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (armedTool?.target === 'edge') {
            e.stopPropagation();
            onPlace(edge.id);
          }
        }}
      >
        <meshStandardMaterial color="#3a3733" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {curbs.map((line, i) => <primitive key={i} object={line} />)}
      <mesh geometry={geometry} position={[0, 0.08 + yJitter, 0]}>
        <meshBasicMaterial color={color} transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {lanes >= 2 && <primitive object={centerline} />}
      {edit?.hasBusLane && (
        <mesh geometry={geometry} position={[0, 0.22, 0]}>
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.18} wireframe side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {acceptable && (
        <mesh geometry={geometry} position={[0, 0.3, 0]}>
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function JunctionNode({ node, edits, armedTool, onPlace }: { node: RoadNode; edits: CityEdits; armedTool: ToolDef | null; onPlace: (id: number) => void }) {
  const trafficLightGltf = useGLTF(MODEL_URLS.trafficLight);
  const bushGltf = useGLTF(MODEL_URLS.parkBush);
  const hedgeGltf = useGLTF(MODEL_URLS.parkHedgeCorner);
  const edit = edits.nodeEdits[node.id];
  const acceptable = armedTool?.target === 'node';
  const radius = roundaboutRadius(node);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (armedTool?.target === 'node') {
      e.stopPropagation();
      onPlace(node.id);
    }
  };

  if (edit?.roundabout) {
    // No roundabout model matched the scene well, so this stays procedural: curb,
    // circulating lane, faint yield markings, and a landscaped central island.
    const bushSpots = [0, 1, 2, 3].map((i) => (i / 4) * Math.PI * 2 + 0.4);
    return (
      <group position={[node.pos.x, 0.08, node.pos.z]} onClick={handleClick}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.98, radius * 1.08, 40]} />
          <meshStandardMaterial color="#a8a29e" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.55, radius * 0.98, 40]} />
          <meshStandardMaterial color="#3a3733" />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.92, radius * 0.96, 40]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius * 0.55, 28]} />
          <meshStandardMaterial color="#8a8580" />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius * 0.48, 24]} />
          <meshStandardMaterial color="#3f6212" />
        </mesh>
        {bushSpots.map((a, i) => (
          <group key={i} position={[Math.cos(a) * radius * 0.3, 0, Math.sin(a) * radius * 0.3]} rotation={[0, a, 0]}>
            <Clone object={(i % 2 === 0 ? bushGltf : hedgeGltf).scene} scale={MODEL_SCALE.parkBush} />
          </group>
        ))}
      </group>
    );
  }

  return (
    <group position={[node.pos.x, 0.07, node.pos.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
        <circleGeometry args={[acceptable ? 8 : 3, 20]} />
        <meshBasicMaterial color={acceptable ? '#38bdf8' : '#78716c'} transparent opacity={acceptable ? 0.35 : 0.5} />
      </mesh>
      {edit?.trafficLights === false ? (
        <Html center distanceFactor={140}>
          <IconWarning style={{ width: 20, height: 20, color: '#f87171', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }} />
        </Html>
      ) : (
        <>
          <TrafficLightPost gltf={trafficLightGltf} position={[radius * 1.35, 0, radius * 1.35]} rotationY={(Math.PI * 5) / 4} nodeEdit={edit} group={0} />
          <TrafficLightPost gltf={trafficLightGltf} position={[-radius * 1.35, 0, -radius * 1.35]} rotationY={Math.PI / 4} nodeEdit={edit} group={1} />
        </>
      )}
    </group>
  );
}

function TrafficLightPost({
  gltf,
  position,
  rotationY,
  nodeEdit,
  group,
}: {
  gltf: ReturnType<typeof useGLTF>;
  position: [number, number, number];
  rotationY: number;
  nodeEdit: NodeEdit | undefined;
  group: 0 | 1;
}) {
  const lampRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const lampHeight = 3.2 * MODEL_SCALE.trafficLight;

  useFrame((state) => {
    const color = signalColor(nodeEdit, group, state.clock.elapsedTime);
    const hex = color === 'red' ? '#ef4444' : '#22c55e';
    if (lampRef.current) (lampRef.current.material as THREE.MeshBasicMaterial).color.set(hex);
    if (lightRef.current) lightRef.current.color.set(hex);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Clone object={gltf.scene} scale={MODEL_SCALE.trafficLight} />
      <mesh ref={lampRef} position={[0, lampHeight, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <pointLight ref={lightRef} position={[0, lampHeight, 0]} color="#22c55e" intensity={2.5} distance={12} decay={2} />
    </group>
  );
}

interface BuildingSlot {
  id: string;
  x: number;
  z: number;
  footprintDiameter: number;
  levels: number;
}

// Real OSM footprints are usually sparse for a single-intersection bbox (that's the
// scope we want — one street, not a whole district). Fill the remaining open ground
// with procedurally-placed buildings so the street doesn't read as empty, using the
// same nearest-road-facing rule as the real ones so it still looks intentional rather
// than scattered. Filler never overlaps a road, a real building, or another filler.
function buildFillerSlots(district: DistrictData, realSlots: BuildingSlot[]): BuildingSlot[] {
  const { minX, maxX, minZ, maxZ } = district.bounds;
  const filler: BuildingSlot[] = [];
  const attempts = 140;
  const target = 26;

  for (let i = 0; i < attempts && filler.length < target; i++) {
    const x = minX + hash(i * 12.9 + 3) * (maxX - minX);
    const z = minZ + hash(i * 5.7 + 9) * (maxZ - minZ);
    const footprintDiameter = 7 + hash(i * 8.3 + 1) * 7;
    const margin = footprintDiameter / 2 + 3;

    const tooCloseToRoad = district.roads.some((edge) => edge.points.some((p) => Math.hypot(p.x - x, p.z - z) < margin + 4));
    const tooCloseToExisting = [...realSlots, ...filler].some((s) => Math.hypot(s.x - x, s.z - z) < (s.footprintDiameter + footprintDiameter) / 2 + 4);
    if (tooCloseToRoad || tooCloseToExisting) continue;

    filler.push({ id: `filler-${i}`, x, z, footprintDiameter, levels: 2 + Math.floor(hash(i * 4.1 + 2) * 7) });
  }
  return filler;
}

function Buildings({ district }: { district: DistrictData }) {
  // Fixed set of 8 city-building variants — safe to call useGLTF unconditionally per key.
  const gltfs: Partial<Record<(typeof CITY_BUILDING_KEYS)[number], ReturnType<typeof useGLTF>>> = {};
  for (const key of CITY_BUILDING_KEYS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- CITY_BUILDING_KEYS is a fixed constant array, same length/order every render
    gltfs[key] = useGLTF(MODEL_URLS[key]);
  }

  // Flat point cloud of every road, used to find each building's nearest street so it
  // can face it — reads as an intentional streetscape instead of randomly-rotated boxes.
  const roadPoints = useMemo(() => district.roads.flatMap((r) => r.points), [district.roads]);

  const slots = useMemo(() => {
    const real: BuildingSlot[] = district.buildings.map((b) => {
      const centroid = polygonCentroid(b.points);
      let maxDist = 0;
      for (const p of b.points) maxDist = Math.max(maxDist, Math.hypot(p.x - centroid.x, p.z - centroid.z));
      return { id: b.id, x: centroid.x, z: centroid.z, footprintDiameter: maxDist * 2, levels: b.levels };
    });
    return [...real, ...buildFillerSlots(district, real)];
  }, [district]);

  return (
    <group>
      {slots.map((slot, i) => {
        const key = CITY_BUILDING_KEYS[Math.floor(hash(i * 3.3 + 1) * CITY_BUILDING_KEYS.length)];
        const gltf = gltfs[key];
        if (!gltf) return null;
        const baseScale = MODEL_SCALE[key] ?? 1;
        const footprintFactor = clamp(slot.footprintDiameter / 9, 0.6, 2.4);
        const heightFactor = clamp((slot.levels * 3.2) / 12, 0.7, 2.8);

        let nearest = roadPoints[0];
        let nearestDist = Infinity;
        for (const p of roadPoints) {
          const d = Math.hypot(p.x - slot.x, p.z - slot.z);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = p;
          }
        }
        const rot = nearest ? Math.atan2(nearest.x - slot.x, nearest.z - slot.z) : 0;

        return (
          <group key={slot.id} position={[slot.x, 0, slot.z]} rotation={[0, rot, 0]}>
            <Clone object={gltf.scene} scale={[baseScale * footprintFactor, baseScale * heightFactor, baseScale * footprintFactor]} castShadow receiveShadow />
          </group>
        );
      })}
    </group>
  );
}

const PARK_LAYOUT: { key: keyof typeof MODEL_URLS; dx: number; dz: number; rot: number }[] = [
  { key: 'parkFloorA', dx: 0, dz: 0, rot: 0 },
  { key: 'parkFountain', dx: 0, dz: 0, rot: 0 },
  { key: 'parkBench', dx: 6, dz: 3, rot: 0.4 },
  { key: 'parkBench', dx: -6, dz: -3, rot: 0.4 + Math.PI },
  { key: 'parkTreeLarge', dx: -8, dz: 6, rot: 0.1 },
  { key: 'parkTree', dx: 8, dz: -6, rot: 0.9 },
  { key: 'parkTree', dx: 7, dz: 7, rot: 2.1 },
  { key: 'parkBush', dx: -5, dz: 8, rot: 0 },
  { key: 'parkBush', dx: 5, dz: -8, rot: 0 },
  { key: 'parkHedgeLong', dx: 0, dz: 10, rot: 0 },
  { key: 'parkFlowerA', dx: 3, dz: -3, rot: 0 },
  { key: 'parkFlowerB', dx: -3, dz: 3, rot: 0 },
  { key: 'parkLantern', dx: -9, dz: -9, rot: 0 },
  { key: 'parkTrashcan', dx: 9, dz: 9, rot: 0 },
];

function ParkCluster() {
  const parts: Partial<Record<(typeof PARK_LAYOUT)[number]['key'], ReturnType<typeof useGLTF>>> = {};
  const uniqueKeys = Array.from(new Set(PARK_LAYOUT.map((p) => p.key)));
  for (const key of uniqueKeys) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- uniqueKeys is derived from a fixed constant, stable every render
    parts[key] = useGLTF(MODEL_URLS[key]);
  }
  return (
    <group>
      {PARK_LAYOUT.map((p, i) => {
        const gltf = parts[p.key];
        if (!gltf) return null;
        return (
          <group key={i} position={[p.dx, 0, p.dz]} rotation={[0, p.rot, 0]}>
            <Clone object={gltf.scene} scale={MODEL_SCALE[p.key] ?? 1} castShadow receiveShadow />
          </group>
        );
      })}
    </group>
  );
}

function PlacedItems({ edits, onRemove }: { edits: CityEdits; onRemove: (id: string) => void }) {
  const chargingStation = useGLTF(MODEL_URLS.chargingStation);
  const apartmentsGltf = useGLTF(MODEL_URLS[BUILDING_TYPE_MODEL.apartments]);
  const schoolGltf = useGLTF(MODEL_URLS[BUILDING_TYPE_MODEL.school]);
  const hospitalGltf = useGLTF(MODEL_URLS[BUILDING_TYPE_MODEL.hospital]);
  const typedBuildingGltf = { apartments: apartmentsGltf, school: schoolGltf, hospital: hospitalGltf };

  return (
    <group>
      {edits.placedItems.map((item) => {
        const handleClick = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onRemove(item.id);
        };

        let body: ReactNode;
        if (item.type === 'apartments' || item.type === 'school' || item.type === 'hospital') {
          const key = BUILDING_TYPE_MODEL[item.type];
          body = <Clone object={typedBuildingGltf[item.type].scene} scale={MODEL_SCALE[key] ?? 1} castShadow receiveShadow onClick={handleClick} />;
        } else if (item.type === 'evStation') {
          body = <Clone object={chargingStation.scene} scale={MODEL_SCALE.chargingStation} castShadow receiveShadow onClick={handleClick} />;
        } else if (item.type === 'park') {
          body = (
            <group onClick={handleClick}>
              <ParkCluster />
            </group>
          );
        } else {
          // lake — no water asset provided, a flat disc reads fine
          body = (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} onClick={handleClick}>
              <circleGeometry args={[11, 32]} />
              <meshStandardMaterial color={ITEM_COLORS.lake} metalness={0.3} roughness={0.2} />
            </mesh>
          );
        }

        const ItemIcon = PLOT_ICON[item.type];
        return (
          <group key={item.id} position={[item.pos.x, 0, item.pos.z]}>
            {body}
            <Html position={[0, item.type === 'park' || item.type === 'lake' ? 3 : 14, 0]} center distanceFactor={140}>
              <ItemIcon style={{ width: 20, height: 20, color: '#f8fafc', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }} />
            </Html>
          </group>
        );
      })}
    </group>
  );
}

interface CarDesc {
  id: string;
  edge: RoadEdge;
  t: number;
  forward: boolean; // true: travelling nodeIds[0] -> nodeIds[last] (t increasing)
  modelKey: (typeof CAR_MODEL_KEYS)[number];
  currentSpeedFrac: number; // eased fraction-of-path/sec — this is what actually moves the car
  laneIndex: number; // which lane within its direction (0 = closest to centerline)
  ringExit?: { edge: RoadEdge; nodeId: number }; // set while circulating a roundabout arc
}

function lanesPerDirection(edge: RoadEdge, edits: CityEdits): number {
  const total = edgeLanes(edge, edits);
  // A one-way edge's lane count is already all-one-direction (that's what the OSM tag
  // means) — don't halve it the way a real two-way road's total lane count needs to be.
  return edge.oneway ? Math.max(1, total) : Math.max(1, Math.floor(total / 2));
}

// Can a car enter `edge` at `atNodeId` and legally drive it? Oneway edges only allow
// entry at nodeIds[0] (driving nodeIds[0] -> last, our "forward") — entering at the far
// end would mean driving it backward against the tagged direction.
function canEnterEdgeAt(edge: RoadEdge, atNodeId: number): boolean {
  if (!edge.oneway) return true;
  return edge.nodeIds[0] === atNodeId;
}

function edgeLanes(edge: RoadEdge, edits: CityEdits): number {
  return Math.max(1, edge.baseLanes + (edits.edgeEdits[edge.id]?.widenCount ?? 0));
}

const BRAKE_ZONE_M = 26; // start slowing this far from a red light/closed roundabout gate
const ACCEL_RESPONSIVENESS = 2.4; // higher = snappier speed changes (exponential ease rate)
const MIN_FOLLOW_GAP_M = 7; // never end up closer than this to the car ahead, same edge+direction
const MAX_CARS_PER_EDGE = 9; // hard cap so a jammed road doesn't spawn an unbounded pile
const SPAWN_CHECK_INTERVAL_SEC = 1.5; // how often to reassess "does this road need more cars"

function baseCarCount(edge: RoadEdge): number {
  return Math.max(1, Math.min(5, edge.baseLanes * 2));
}

// How many cars a road "should" have right now — scales up with live congestion so a
// peak-hour jam actually looks like a jam (more cars, more of them queued at lights)
// instead of the same handful of cars just driving slower.
function targetCarCount(edge: RoadEdge, congestion: number): number {
  const factor = clamp(0.6 + congestion * 1.8, 0.6, 2.6);
  return Math.max(1, Math.min(MAX_CARS_PER_EDGE, Math.round(baseCarCount(edge) * factor)));
}

function spawnCar(edge: RoadEdge, edits: CityEdits, seed: number): CarDesc {
  const perDir = lanesPerDirection(edge, edits);
  return {
    id: `car-${edge.id}-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    edge,
    t: hash(seed * 13),
    forward: edge.oneway || hash(seed * 17) > 0.5,
    modelKey: CAR_MODEL_KEYS[Math.floor(hash(seed * 31) * CAR_MODEL_KEYS.length)],
    currentSpeedFrac: 0,
    laneIndex: Math.floor(hash(seed * 23) * perDir),
  };
}

function Cars({ district, edits, metrics }: { district: DistrictData; edits: CityEdits; metrics: Map<string, EdgeMetrics> }) {
  // Fixed, known set of models — safe to call useGLTF unconditionally per key (drei caches by URL).
  const suv = useGLTF(MODEL_URLS.suv);
  const sportsCar = useGLTF(MODEL_URLS.sportsCar);
  const taxi = useGLTF(MODEL_URLS.taxi);
  const policeCar = useGLTF(MODEL_URLS.policeCar);
  const carGltfs = { suv, sportsCar, taxi, policeCar };

  const groupsByNode = useMemo(() => computeApproachGroups(district), [district]);
  const adjacency = useMemo(() => buildAdjacency(district), [district]);

  // Spawn a light baseline once per district load — congestion-driven growth (below)
  // tops each road up toward its live target without ever touching/rescattering the
  // cars that already exist, so placing a tool or the clock ticking never resets anyone
  // already on screen; it only ever adds more.
  const [cars, setCars] = useState<CarDesc[]>(() => {
    const list: CarDesc[] = [];
    district.roads.forEach((edge, ei) => {
      const count = baseCarCount(edge);
      for (let i = 0; i < count; i++) {
        const car = spawnCar(edge, edits, ei * 97 + i * 7);
        car.t = (i / count + hash(ei * 13 + i) * 0.3) % 1;
        list.push(car);
      }
    });
    return list;
  });

  const spawnCheckAccum = useRef(0);
  useFrame((_, delta) => {
    spawnCheckAccum.current += delta;
    if (spawnCheckAccum.current < SPAWN_CHECK_INTERVAL_SEC) return;
    spawnCheckAccum.current = 0;

    setCars((prev) => {
      const countByEdge = new Map<string, number>();
      for (const c of prev) countByEdge.set(c.edge.id, (countByEdge.get(c.edge.id) ?? 0) + 1);

      const additions: CarDesc[] = [];
      district.roads.forEach((edge, ei) => {
        const congestion = metrics.get(edge.id)?.congestion ?? 0;
        const target = targetCarCount(edge, congestion);
        const current = countByEdge.get(edge.id) ?? 0;
        for (let k = current; k < target; k++) {
          additions.push(spawnCar(edge, edits, ei * 5000 + k * 31 + Math.round(performance.now())));
        }
      });

      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  });

  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;

    // Snapshot positions before anyone moves this frame, grouped by (edge, direction) —
    // collision/following-distance checks use this consistent "where's everyone" picture
    // rather than racing against cars that already moved earlier in the loop.
    const laneGroups = new Map<string, CarDesc[]>();
    cars.forEach((car) => {
      const key = `${car.edge.id}_${car.forward ? 'f' : 'r'}`;
      const arr = laneGroups.get(key);
      if (arr) arr.push(car);
      else laneGroups.set(key, [car]);
    });

    cars.forEach((car, i) => {
      const signal = junctionControlsThisApproach(district, edits, groupsByNode, car.edge, car.forward, elapsed);
      const remainingFrac = car.forward ? 1 - car.t : car.t;
      const remainingM = remainingFrac * car.edge.lengthM;

      // Nearest car ahead of us on the same edge, same direction (snapshot t, not yet moved).
      let aheadT: number | null = null;
      const key = `${car.edge.id}_${car.forward ? 'f' : 'r'}`;
      for (const other of laneGroups.get(key) ?? []) {
        if (other === car) continue;
        if (car.forward && other.t > car.t && (aheadT === null || other.t < aheadT)) aheadT = other.t;
        if (!car.forward && other.t < car.t && (aheadT === null || other.t > aheadT)) aheadT = other.t;
      }
      const gapAheadM = aheadT === null ? Infinity : Math.abs(aheadT - car.t) * car.edge.lengthM;

      const liveSpeed = metrics.get(car.edge.id)?.speed ?? 30;
      const cruiseFrac = Math.max(0.015, liveSpeed / Math.max(30, car.edge.lengthM));

      // Smoothly brake toward whichever is closer: a red light/closed roundabout gate, or
      // the car ahead — 0 right at the stop line/bumper, ramping up to full speed by
      // BRAKE_ZONE_M out. This is what makes traffic queue and release like real traffic
      // instead of every car ignoring everything else on the road.
      let targetFrac = cruiseFrac;
      if (signal === 'red' && remainingM < BRAKE_ZONE_M) {
        const brakeT = clamp((remainingM - STOP_LINE_DISTANCE_M) / (BRAKE_ZONE_M - STOP_LINE_DISTANCE_M), 0, 1);
        targetFrac = Math.min(targetFrac, cruiseFrac * brakeT);
      }
      if (gapAheadM < BRAKE_ZONE_M) {
        const followT = clamp((gapAheadM - MIN_FOLLOW_GAP_M) / (BRAKE_ZONE_M - MIN_FOLLOW_GAP_M), 0, 1);
        targetFrac = Math.min(targetFrac, cruiseFrac * followT);
      }
      car.currentSpeedFrac += (targetFrac - car.currentSpeedFrac) * Math.min(1, delta * ACCEL_RESPONSIVENESS);

      car.t += car.currentSpeedFrac * delta * (car.forward ? 1 : -1);

      // Hard clamps so residual creep from the easing never actually crosses the stop line
      // on red, or rear-ends the car ahead, even if the soft braking above overshoots.
      if (signal === 'red') {
        const stopT = car.forward ? 1 - STOP_LINE_DISTANCE_M / car.edge.lengthM : STOP_LINE_DISTANCE_M / car.edge.lengthM;
        if (car.forward && car.t > stopT) car.t = stopT;
        if (!car.forward && car.t < stopT) car.t = stopT;
      }
      if (aheadT !== null) {
        const minGapFrac = MIN_FOLLOW_GAP_M / car.edge.lengthM;
        if (car.forward && car.t > aheadT - minGapFrac) car.t = Math.max(0, aheadT - minGapFrac);
        if (!car.forward && car.t < aheadT + minGapFrac) car.t = Math.min(1, aheadT + minGapFrac);
      }

      if (car.t >= 1 || car.t <= 0) {
        if (car.ringExit) {
          // just finished circulating a roundabout arc — go straight to the exit
          // road picked when it entered, no re-check needed (already yielded on entry)
          const exit = car.ringExit;
          car.edge = exit.edge;
          car.forward = exit.edge.nodeIds[0] === exit.nodeId;
          car.laneIndex = Math.min(car.laneIndex, lanesPerDirection(exit.edge, edits) - 1);
          car.t = car.forward ? 0.01 : 0.99;
          car.ringExit = undefined;
        } else {
          const arrivedAt = car.forward ? car.edge.nodeIds[car.edge.nodeIds.length - 1] : car.edge.nodeIds[0];
          const node = district.nodes.get(arrivedAt);
          const options = (adjacency.get(arrivedAt) ?? []).filter((e) => e.id !== car.edge.id && canEnterEdgeAt(e, arrivedAt));
          // Roundabout edits are stored against the cluster's controlling node, which may
          // not be this exact raw endpoint if it's a consolidated multi-fragment junction.
          const controllingNodeId = district.clusterRepOf.get(arrivedAt) ?? arrivedAt;
          if (options.length > 0 && node && edits.nodeEdits[controllingNodeId]?.roundabout) {
            // entering a roundabout: circulate the ring to a chosen exit instead of
            // jumping straight across the intersection
            const exitEdge = options[Math.floor(hash(elapsed * 97 + i * 53) * options.length)];
            car.edge = buildRoundaboutArc(node, car.edge, exitEdge, arrivedAt);
            car.forward = true;
            car.laneIndex = 0;
            car.t = 0.01;
            car.ringExit = { edge: exitEdge, nodeId: arrivedAt };
          } else if (options.length > 0) {
            const next = options[Math.floor(hash(elapsed * 97 + i * 53) * options.length)];
            car.edge = next;
            car.forward = next.nodeIds[0] === arrivedAt;
            car.laneIndex = Math.min(car.laneIndex, lanesPerDirection(next, edits) - 1);
            // Nudge just off the boundary (not exactly 0/1) — otherwise a car that's
            // immediately blocked on the new edge re-triggers this arrival branch next
            // frame and re-routes again before ever actually driving the segment,
            // which looks like cars skipping/teleporting through junctions.
            car.t = car.forward ? 0.01 : 0.99;
          } else {
            // Genuine dead end (rare) — no legal onward edge, including on a oneway
            // street. Turning around in place isn't realistic there, but it's the only
            // way to avoid a car freezing on screen forever; true dead ends are uncommon
            // enough after the canEnterEdgeAt filter above that this shouldn't come up often.
            car.forward = !car.forward;
            car.t = car.forward ? 0.01 : 0.99;
          }
        }
      }

      const { pos, dir } = pointAtT(car.edge.points, car.t);
      const perDir = lanesPerDirection(car.edge, edits);
      // Distance from the road's centerline to the middle of this car's lane, on its
      // own side of the road (lane 0 = closest to centerline, matches left-hand traffic
      // keeping to the near-side lane; higher lane indices sit further toward the curb).
      const laneOffset = (Math.min(car.laneIndex, perDir - 1) + 0.5) * LANE_WIDTH;
      const nx = -dir.z;
      const nz = dir.x;
      const sign = car.forward ? 1 : -1;

      const group = refs.current[i];
      if (!group) return;
      group.position.set(pos.x + nx * laneOffset * sign, 0.1, pos.z + nz * laneOffset * sign);
      const facing = car.forward ? dir : { x: -dir.x, z: -dir.z };
      group.rotation.y = Math.atan2(facing.x, facing.z) + (MODEL_YAW_OFFSET[car.modelKey] ?? 0);
    });
  });

  return (
    <group>
      {cars.map((car, i) => (
        <group key={car.id} ref={(el) => { refs.current[i] = el; }} castShadow>
          <Clone object={carGltfs[car.modelKey].scene} scale={MODEL_SCALE[car.modelKey]} />
        </group>
      ))}
    </group>
  );
}

function Trees({ district }: { district: DistrictData }) {
  const tree1 = useGLTF(MODEL_URLS.tree1);
  const tree2 = useGLTF(MODEL_URLS.tree2);
  const tree3 = useGLTF(MODEL_URLS.tree3);
  const treeGltfs = { tree1, tree2, tree3 };

  const trees = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = district.bounds;
    const realSlots: BuildingSlot[] = district.buildings.map((b) => {
      const centroid = polygonCentroid(b.points);
      let maxDist = 0;
      for (const p of b.points) maxDist = Math.max(maxDist, Math.hypot(p.x - centroid.x, p.z - centroid.z));
      return { id: b.id, x: centroid.x, z: centroid.z, footprintDiameter: maxDist * 2, levels: b.levels };
    });
    const allBuildingSlots = [...realSlots, ...buildFillerSlots(district, realSlots)];

    const list: { x: number; z: number; key: (typeof TREE_MODEL_KEYS)[number]; rot: number }[] = [];
    const attempts = 220;
    for (let i = 0; i < attempts && list.length < 90; i++) {
      const x = minX + hash(i * 3.1) * (maxX - minX);
      const z = minZ + hash(i * 7.7 + 1) * (maxZ - minZ);
      const tooCloseToRoad = district.roads.some((edge) => edge.points.some((p) => Math.hypot(p.x - x, p.z - z) < 10));
      const tooCloseToBuilding = allBuildingSlots.some((s) => Math.hypot(s.x - x, s.z - z) < s.footprintDiameter / 2 + 5);
      if (tooCloseToRoad || tooCloseToBuilding) continue;
      list.push({ x, z, key: TREE_MODEL_KEYS[Math.floor(hash(i * 2.3) * TREE_MODEL_KEYS.length)], rot: hash(i * 5.9) * Math.PI * 2 });
    }
    return list;
  }, [district]);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[0, t.rot, 0]}>
          <Clone object={treeGltfs[t.key].scene} scale={MODEL_SCALE[t.key]} />
        </group>
      ))}
    </group>
  );
}

function StopLights({ district, edits }: { district: DistrictData; edits: CityEdits }) {
  const groupsByNode = useMemo(() => computeApproachGroups(district), [district]);
  const approaches = useMemo(() => junctionApproaches(district), [district]);

  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    approaches.forEach((a, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const signal = junctionControlsThisApproach(district, edits, groupsByNode, a.edge, a.headingToEnd, elapsed);
      (mesh.material as THREE.MeshBasicMaterial).color.set(signal === 'red' ? '#ef4444' : '#22c55e');
    });
  });

  return (
    <group>
      {approaches.map((a, i) => {
        const frac = Math.min(0.45, STOP_LINE_DISTANCE_M / a.edge.lengthM);
        const t = a.headingToEnd ? 1 - frac : frac;
        const { pos } = pointAtT(a.edge.points, t);
        return (
          <mesh key={i} ref={(el) => { refs.current[i] = el; }} position={[pos.x, 1.4, pos.z]}>
            <sphereGeometry args={[0.9, 10, 10]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        );
      })}
    </group>
  );
}

function PedestrianCrossings({ district, edits }: { district: DistrictData; edits: CityEdits }) {
  const approaches = useMemo(() => junctionApproaches(district), [district]);

  return (
    <group>
      {approaches.map((a, i) => {
        // sit just outside the stop line, between waiting cars and the junction itself
        const frac = Math.min(0.47, (STOP_LINE_DISTANCE_M - 3) / a.edge.lengthM);
        const t = a.headingToEnd ? 1 - frac : frac;
        const { pos, dir } = pointAtT(a.edge.points, t);
        const roadWidth = edgeLanes(a.edge, edits) * LANE_WIDTH;
        const rot = Math.atan2(dir.x, dir.z);
        const stripeCount = 6;
        const crossingDepth = 3; // meters along the direction of travel
        return (
          <group key={i} position={[pos.x, 0.09, pos.z]} rotation={[0, rot, 0]}>
            {Array.from({ length: stripeCount }).map((_, s) => (
              <mesh
                key={s}
                position={[0, 0, -crossingDepth / 2 + (s / (stripeCount - 1)) * crossingDepth]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[roadWidth * 0.82, crossingDepth / stripeCount / 2]} />
                <meshBasicMaterial color="#f8fafc" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function StreetLights({ district, isNight }: { district: DistrictData; isNight: number }) {
  const gltf = useGLTF(MODEL_URLS.streetLight);

  // One lamp near each junction corner (reuses the same corner spot the traffic-light
  // pair sits at, offset further out) — modest, deterministic placement rather than
  // scattering along every meter of sidewalk.
  const spots = useMemo(() => {
    const list: { x: number; z: number; radius: number }[] = [];
    for (const node of district.nodes.values()) {
      if (!node.isJunction) continue;
      const radius = 6 + Math.min(4, node.degree);
      list.push({ x: node.pos.x + radius * 1.7, z: node.pos.z - radius * 0.4, radius });
      list.push({ x: node.pos.x - radius * 0.4, z: node.pos.z + radius * 1.7, radius });
    }
    return list;
  }, [district]);

  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const bulbRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const intensity = isNight > 0.3 ? (isNight - 0.3) * 32 : 0;
    const bulbOpacity = Math.max(0.05, Math.min(1, isNight > 0.3 ? (isNight - 0.3) * 1.6 : 0.05));
    lightRefs.current.forEach((l) => {
      if (l) l.intensity = intensity;
    });
    bulbRefs.current.forEach((b) => {
      if (b) (b.material as THREE.MeshBasicMaterial).opacity = bulbOpacity;
    });
  });

  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <Clone object={gltf.scene} scale={MODEL_SCALE.streetLight} />
          <mesh ref={(el) => { bulbRefs.current[i] = el; }} position={[0, 6, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#ffe4a8" transparent opacity={0.05} />
          </mesh>
          <pointLight ref={(el) => { lightRefs.current[i] = el; }} position={[0, 6, 0]} color="#ffd9a0" intensity={0} distance={38} decay={1.6} />
        </group>
      ))}
    </group>
  );
}

const ACCESSIBILITY_PATH_COLORS = {
  green: '#22c55e',
  amber: '#facc15',
  red: '#ef4444',
  grey: '#94a3b8',
} as const;

type AccessibilityPathStatus = keyof typeof ACCESSIBILITY_PATH_COLORS;

function pathAccessibilityStatus(edge: RoadEdge, index: number): AccessibilityPathStatus {
  if (edge.highwayClass === 'primary' || edge.highwayClass === 'trunk' || edge.highwayClass === 'motorway') return 'red';
  if (edge.highwayClass === 'secondary' || edge.highwayClass === 'tertiary') return 'amber';
  if (edge.highwayClass === 'unclassified' || index % 5 === 0) return 'grey';
  return 'green';
}

// Heuristic-only: real accessibility would come from OSM kerb/sidewalk/wheelchair
// tags, which this bbox mostly doesn't have. Road class stands in as a rough proxy
// (busy arterials = red, quiet residential = green) — good enough for a "does this
// change help or hurt accessibility" visual, not a certified accessibility audit.
function AccessibilityRoutes({ district, route }: { district: DistrictData; route: Props['accessibilityRoute'] }) {
  const roads = useMemo(() => {
    const preferred = district.roads.filter((edge) => ['residential', 'tertiary', 'unclassified'].includes(edge.highwayClass));
    if (route === 'most-accessible') return preferred.length > 0 ? preferred : district.roads.filter((_, i) => i % 2 === 0);
    if (route === 'balanced') return district.roads.filter((_, i) => i % 3 !== 1);
    return district.roads.filter((_, i) => i % 2 === 0);
  }, [district.roads, route]);

  return (
    <group>
      {roads.map((edge, index) => {
        const status = pathAccessibilityStatus(edge, index);
        const roadWidth = Math.max(1, edge.baseLanes) * LANE_WIDTH;
        const sidewalkOffset = roadWidth / 2 + SIDEWALK_WIDTH / 2;
        return [-1, 1].map((side) => {
          const sidePoints = edge.points.map((point, i) => {
            const previous = edge.points[Math.max(0, i - 1)];
            const next = edge.points[Math.min(edge.points.length - 1, i + 1)];
            const dx = next.x - previous.x;
            const dz = next.z - previous.z;
            const length = Math.hypot(dx, dz) || 1;
            return {
              x: point.x + (-dz / length) * sidewalkOffset * side,
              z: point.z + (dx / length) * sidewalkOffset * side,
            };
          });
          const geometry = buildRoadRibbon(sidePoints, 1.5);
          const line = new THREE.Line(
            buildCenterline(sidePoints, 0.42),
            new THREE.LineDashedMaterial({ color: '#f8fafc', dashSize: 2.2, gapSize: 1.8, transparent: true, opacity: 0.75, depthWrite: false }),
          );
          line.computeLineDistances();
          return (
            <group key={`accessibility-route-${route}-${edge.id}-${side}`}>
              <mesh geometry={geometry} position={[0, 0.38, 0]} raycast={() => null}>
                <meshBasicMaterial color={ACCESSIBILITY_PATH_COLORS[status]} transparent opacity={0.92} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
              <primitive object={line} raycast={() => null} />
            </group>
          );
        });
      })}
    </group>
  );
}

function Ground({ district, armedTool, onPlaceGround }: { district: DistrictData; armedTool: ToolDef | null; onPlaceGround: (x: number, z: number) => void }) {
  const { minX, maxX, minZ, maxZ } = district.bounds;
  const w = maxX - minX + 400;
  const h = maxZ - minZ + 400;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[cx, -0.05, cz]}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (armedTool?.target === 'ground') {
          e.stopPropagation();
          onPlaceGround(e.point.x, e.point.z);
        }
      }}
    >
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color="#3f6212" roughness={1} />
    </mesh>
  );
}

export default function CityScene({ district, edits, metrics, hour, armedTool, onPlaceNode, onPlaceEdge, onPlaceGround, onRemoveItem, accessibilityEnabled, accessibilityRoute }: Props) {
  const { minX, maxX, minZ, maxZ } = district.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const size = Math.max(maxX - minX, maxZ - minZ, 200);

  const junctionNodes = useMemo(() => Array.from(district.nodes.values()).filter((n) => n.isJunction), [district.nodes]);

  const sky = computeSkyState(hour);
  const sunHeight = size * (0.4 + 1.3 * sky.sunElevation01);
  const sunX = cx + size * (sky.sunAzimuth01 * 2 - 1);
  const sunZ = cz + size * 0.4;

  return (
    <div className="absolute inset-0" style={{ cursor: armedTool ? 'crosshair' : 'grab' }}>
      <Canvas
        shadows
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ position: [cx + size * 0.7, size * 0.9, cz + size * 0.9], fov: 45, near: 2, far: size * 6 }}
      >
        <color attach="background" args={[sky.skyColor]} />
        <fog attach="fog" args={[sky.fogColor, size * (1.5 - 0.5 * sky.isNight), size * 5]} />
        <ambientLight intensity={sky.ambientIntensity} color={sky.isNight > 0.5 ? '#8ea2d8' : '#ffffff'} />
        <directionalLight
          position={[sunX, sunHeight, sunZ]}
          intensity={sky.sunIntensity}
          color={sky.sunColor}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <hemisphereLight args={[sky.skyColor, '#1a2e05', 0.35 + 0.2 * (1 - sky.isNight)]} />

        <Ground district={district} armedTool={armedTool} onPlaceGround={onPlaceGround} />

        {district.roads.map((edge) => (
          <Road key={edge.id} edge={edge} edits={edits} metric={metrics.get(edge.id)} armedTool={armedTool} onPlace={onPlaceEdge} />
        ))}

        {junctionNodes.map((node) => (
          <JunctionNode key={node.id} node={node} edits={edits} armedTool={armedTool} onPlace={onPlaceNode} />
        ))}
        <StopLights district={district} edits={edits} />
        <PedestrianCrossings district={district} edits={edits} />
        <StreetLights district={district} isNight={sky.isNight} />
        {accessibilityEnabled && <AccessibilityRoutes district={district} route={accessibilityRoute} />}

        <Buildings district={district} />
        <Trees district={district} />
        <PlacedItems edits={edits} onRemove={onRemoveItem} />
        <Cars district={district} edits={edits} metrics={metrics} />

        <OrbitControls
          target={[cx, 0, cz]}
          minDistance={size * 0.05}
          maxDistance={size * 4}
          minPolarAngle={0.02}
          maxPolarAngle={Math.PI * 0.495}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URLS.suv);
useGLTF.preload(MODEL_URLS.sportsCar);
useGLTF.preload(MODEL_URLS.taxi);
useGLTF.preload(MODEL_URLS.policeCar);
useGLTF.preload(MODEL_URLS.trafficLight);
useGLTF.preload(MODEL_URLS.tree1);
useGLTF.preload(MODEL_URLS.tree2);
useGLTF.preload(MODEL_URLS.tree3);
for (const key of CITY_BUILDING_KEYS) useGLTF.preload(MODEL_URLS[key]);
useGLTF.preload(MODEL_URLS.chargingStation);
useGLTF.preload(MODEL_URLS.streetLight);
useGLTF.preload(MODEL_URLS.parkBush);
useGLTF.preload(MODEL_URLS.parkHedgeCorner);
