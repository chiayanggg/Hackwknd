import { useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Clone } from '@react-three/drei';
import * as THREE from 'three';
import type { CityEdits, DistrictData, EdgeMetrics, RoadEdge, RoadNode } from '../types';
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
import { buildAdjacency, computeApproachGroups, junctionControlsThisApproach, STOP_LINE_DISTANCE_M } from '../lib/traffic';
import { congestionColor } from '../lib/ruleEngine';
import { IconWarning } from './icons';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface Props {
  district: DistrictData;
  edits: CityEdits;
  metrics: Map<string, EdgeMetrics>;
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

  return (
    <group>
      {/* sidewalk — a wider, lighter ribbon under the asphalt; only its outer margin ends up visible */}
      <mesh geometry={sidewalkGeometry} position={[0, -0.01, 0]}>
        <meshStandardMaterial color="#8a8580" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        geometry={geometry}
        position={[0, 0, 0]}
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
      <mesh geometry={geometry} position={[0, 0.08, 0]}>
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
  const edit = edits.nodeEdits[node.id];
  const acceptable = armedTool?.target === 'node';
  const radius = 6 + Math.min(4, node.degree);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (armedTool?.target === 'node') {
      e.stopPropagation();
      onPlace(node.id);
    }
  };

  if (edit?.roundabout) {
    return (
      <group position={[node.pos.x, 0.08, node.pos.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
          <ringGeometry args={[radius * 0.55, radius, 32]} />
          <meshStandardMaterial color="#57534e" />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius * 0.5, 24]} />
          <meshStandardMaterial color="#3f6212" />
        </mesh>
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
          <Clone object={trafficLightGltf.scene} scale={MODEL_SCALE.trafficLight} position={[radius * 1.35, 0, radius * 1.35]} rotation={[0, (Math.PI * 5) / 4, 0]} />
          <Clone object={trafficLightGltf.scene} scale={MODEL_SCALE.trafficLight} position={[-radius * 1.35, 0, -radius * 1.35]} rotation={[0, Math.PI / 4, 0]} />
        </>
      )}
    </group>
  );
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

  return (
    <group>
      {district.buildings.map((b, i) => {
        const centroid = polygonCentroid(b.points);
        let maxDist = 0;
        for (const p of b.points) maxDist = Math.max(maxDist, Math.hypot(p.x - centroid.x, p.z - centroid.z));
        const footprintDiameter = maxDist * 2;

        const key = CITY_BUILDING_KEYS[Math.floor(hash(i * 3.3 + 1) * CITY_BUILDING_KEYS.length)];
        const gltf = gltfs[key];
        if (!gltf || Array.isArray(gltf)) return null;
        const baseScale = MODEL_SCALE[key] ?? 1;
        const footprintFactor = clamp(footprintDiameter / 9, 0.6, 2.4);
        const heightFactor = clamp((b.levels * 3.2) / 12, 0.7, 2.8);

        let nearest = roadPoints[0];
        let nearestDist = Infinity;
        for (const p of roadPoints) {
          const d = Math.hypot(p.x - centroid.x, p.z - centroid.z);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = p;
          }
        }
        const rot = nearest ? Math.atan2(nearest.x - centroid.x, nearest.z - centroid.z) : 0;

        return (
          <group key={b.id} position={[centroid.x, 0, centroid.z]} rotation={[0, rot, 0]}>
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
        if (!gltf || Array.isArray(gltf)) return null;
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
  edge: RoadEdge;
  t: number;
  forward: boolean; // true: travelling nodeIds[0] -> nodeIds[last] (t increasing)
  modelKey: (typeof CAR_MODEL_KEYS)[number];
  currentSpeedFrac: number; // eased fraction-of-path/sec — this is what actually moves the car
}

function edgeLanes(edge: RoadEdge, edits: CityEdits): number {
  return Math.max(1, edge.baseLanes + (edits.edgeEdits[edge.id]?.widenCount ?? 0));
}

const BRAKE_ZONE_M = 26; // start slowing this far from a red light/closed roundabout gate
const ACCEL_RESPONSIVENESS = 2.4; // higher = snappier speed changes (exponential ease rate)
const MIN_FOLLOW_GAP_M = 7; // never end up closer than this to the car ahead, same edge+direction

function Cars({ district, edits, metrics }: { district: DistrictData; edits: CityEdits; metrics: Map<string, EdgeMetrics> }) {
  // Fixed, known set of models — safe to call useGLTF unconditionally per key (drei caches by URL).
  const suv = useGLTF(MODEL_URLS.suv);
  const sportsCar = useGLTF(MODEL_URLS.sportsCar);
  const taxi = useGLTF(MODEL_URLS.taxi);
  const policeCar = useGLTF(MODEL_URLS.policeCar);
  const carGltfs = { suv, sportsCar, taxi, policeCar };

  const groupsByNode = useMemo(() => computeApproachGroups(district), [district]);
  const adjacency = useMemo(() => buildAdjacency(district), [district]);

  // Spawn once per district load (not per edit/period) — count comes from road class/lane
  // count, not live congestion, so placing a tool doesn't respawn/scatter every car on screen.
  // Speed and stop behaviour below are still read live from `metrics` every frame.
  const cars = useMemo(() => {
    const list: CarDesc[] = [];
    district.roads.forEach((edge, ei) => {
      const count = Math.max(1, Math.min(5, edge.baseLanes * 2));
      for (let i = 0; i < count; i++) {
        list.push({
          edge,
          t: (i / count + hash(ei * 13 + i) * 0.3) % 1,
          forward: hash(ei * 17 + i * 3) > 0.5,
          modelKey: CAR_MODEL_KEYS[Math.floor(hash(ei * 31 + i * 7) * CAR_MODEL_KEYS.length)],
          currentSpeedFrac: 0,
        });
      }
    });
    return list;
  }, [district.roads]);

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
        const arrivedAt = car.forward ? car.edge.nodeIds[car.edge.nodeIds.length - 1] : car.edge.nodeIds[0];
        const options = (adjacency.get(arrivedAt) ?? []).filter((e) => e.id !== car.edge.id);
        if (options.length > 0) {
          const next = options[Math.floor(hash(elapsed * 97 + i * 53) * options.length)];
          car.edge = next;
          car.forward = next.nodeIds[0] === arrivedAt;
          // Nudge just off the boundary (not exactly 0/1) — otherwise a car that's
          // immediately blocked on the new edge re-triggers this arrival branch next
          // frame and re-routes again before ever actually driving the segment,
          // which looks like cars skipping/teleporting through junctions.
          car.t = car.forward ? 0.01 : 0.99;
        } else {
          // dead end — turn around in place, same nudge
          car.forward = !car.forward;
          car.t = car.forward ? 0.01 : 0.99;
        }
      }

      const { pos, dir } = pointAtT(car.edge.points, car.t);
      const lanes = edgeLanes(car.edge, edits);
      const laneOffset = (lanes * LANE_WIDTH) / 4; // keep each direction inside its own half of the road
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
        <group key={i} ref={(el) => { refs.current[i] = el; }} castShadow>
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
    const buildingCentroids = district.buildings.map((b) => {
      let x = 0;
      let z = 0;
      b.points.forEach((p) => {
        x += p.x;
        z += p.z;
      });
      return { x: x / b.points.length, z: z / b.points.length };
    });

    const list: { x: number; z: number; key: (typeof TREE_MODEL_KEYS)[number]; rot: number }[] = [];
    const attempts = 220;
    for (let i = 0; i < attempts && list.length < 90; i++) {
      const x = minX + hash(i * 3.1) * (maxX - minX);
      const z = minZ + hash(i * 7.7 + 1) * (maxZ - minZ);
      const tooCloseToRoad = district.roads.some((edge) => edge.points.some((p) => Math.hypot(p.x - x, p.z - z) < 10));
      const tooCloseToBuilding = buildingCentroids.some((c) => Math.hypot(c.x - x, c.z - z) < 12);
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

interface Approach {
  edge: RoadEdge;
  headingToEnd: boolean;
}

function StopLights({ district, edits }: { district: DistrictData; edits: CityEdits }) {
  const groupsByNode = useMemo(() => computeApproachGroups(district), [district]);

  const approaches = useMemo(() => {
    const list: Approach[] = [];
    for (const node of district.nodes.values()) {
      if (!node.isJunction) continue;
      district.roads.forEach((edge) => {
        if (edge.nodeIds[edge.nodeIds.length - 1] === node.id) list.push({ edge, headingToEnd: true });
        if (edge.nodeIds[0] === node.id) list.push({ edge, headingToEnd: false });
      });
    }
    return list;
  }, [district]);

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
  const approaches = useMemo(() => {
    const list: Approach[] = [];
    for (const node of district.nodes.values()) {
      if (!node.isJunction) continue;
      district.roads.forEach((edge) => {
        if (edge.nodeIds[edge.nodeIds.length - 1] === node.id) list.push({ edge, headingToEnd: true });
        if (edge.nodeIds[0] === node.id) list.push({ edge, headingToEnd: false });
      });
    }
    return list;
  }, [district]);

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
          const sidePoints = edge.points.map((point, index) => {
            const previous = edge.points[Math.max(0, index - 1)];
            const next = edge.points[Math.min(edge.points.length - 1, index + 1)];
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

export default function CityScene({ district, edits, metrics, armedTool, onPlaceNode, onPlaceEdge, onPlaceGround, onRemoveItem, accessibilityEnabled, accessibilityRoute }: Props) {
  const { minX, maxX, minZ, maxZ } = district.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const size = Math.max(maxX - minX, maxZ - minZ, 200);

  const junctionNodes = useMemo(() => Array.from(district.nodes.values()).filter((n) => n.isJunction), [district.nodes]);

  return (
    <div className="absolute inset-0" style={{ cursor: armedTool ? 'crosshair' : 'grab' }}>
      <Canvas
        shadows
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ position: [cx + size * 0.7, size * 0.9, cz + size * 0.9], fov: 45, near: 2, far: size * 6 }}
      >
        <color attach="background" args={['#bcd9f0']} />
        <fog attach="fog" args={['#bcd9f0', size * 1.5, size * 5]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[cx + size, size * 1.2, cz + size * 0.5]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />

        <Ground district={district} armedTool={armedTool} onPlaceGround={onPlaceGround} />

        {district.roads.map((edge) => (
          <Road key={edge.id} edge={edge} edits={edits} metric={metrics.get(edge.id)} armedTool={armedTool} onPlace={onPlaceEdge} />
        ))}

        {accessibilityEnabled && <AccessibilityRoutes district={district} route={accessibilityRoute} />}


        {junctionNodes.map((node) => (
          <JunctionNode key={node.id} node={node} edits={edits} armedTool={armedTool} onPlace={onPlaceNode} />
        ))}
        <StopLights district={district} edits={edits} />
        <PedestrianCrossings district={district} edits={edits} />

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
