// Local .glb assets (CC0 / free, sourced by the user from Poly Pizza / Sketchfab).
// Served from /public/models — reference by URL, loaded with drei's useGLTF.
export const MODEL_URLS = {
  bus: '/models/bus.glb',
  policeCar: '/models/police-car.glb',
  suv: '/models/suv.glb',
  sportsCar: '/models/sports-car.glb',
  taxi: '/models/taxi.glb',
  streetLight: '/models/street-light.glb',
  trafficLight: '/models/traffic-light.glb',
  tree1: '/models/tree-1.glb',
  tree2: '/models/tree-2.glb',
  tree3: '/models/tree-3.glb',
  treeCluster: '/models/tree-cluster.glb',

  buildingLarge1: '/models/building-large-1.glb',
  buildingLarge2: '/models/building-large-2.glb',
  buildingLarge3: '/models/building-large-3.glb',
  buildingLarge4: '/models/building-large-4.glb',
  buildingLarge5: '/models/building-large-5.glb',
  buildingSmall1: '/models/building-small-1.glb',
  buildingSmall2: '/models/building-small-2.glb',
  buildingSmall3: '/models/building-small-3.glb',
  townCenter: '/models/town-center.glb',

  chargingStation: '/models/charging-station/scene.gltf',

  parkBench: '/models/park-bench.glb',
  parkBird: '/models/park-bird.glb',
  parkBushLarge: '/models/park-bush-large.glb',
  parkBush: '/models/park-bush.glb',
  parkFountain: '/models/park-fountain.glb',
  parkGrassA: '/models/park-grass-a.glb',
  parkGrassB: '/models/park-grass-b.glb',
  parkHedgeCorner: '/models/park-hedge-corner.glb',
  parkHedgeLong: '/models/park-hedge-long.glb',
  parkHedge: '/models/park-hedge.glb',
  parkLantern: '/models/park-lantern.glb',
  parkTrashcan: '/models/park-trashcan.glb',
  parkTreeLarge: '/models/park-tree-large.glb',
  parkTree: '/models/park-tree.glb',
  parkFlowerA: '/models/park-flower-a.glb',
  parkFlowerB: '/models/park-flower-b.glb',
  parkFloorA: '/models/park-floor-a.glb',
  parkCobble: '/models/park-cobble.glb',

  roundabout: '/models/roundabout.glb',
} as const;

export const CAR_MODEL_KEYS = ['suv', 'sportsCar', 'taxi', 'policeCar'] as const;
export const TREE_MODEL_KEYS = ['tree1', 'tree2', 'tree3'] as const;

// The OSM-derived city buildings pick randomly from this pool, sized up/down per
// footprint. Apartments/school/hospital placements use a fixed one each instead
// (BUILDING_TYPE_MODEL below) so they read consistently.
export const CITY_BUILDING_KEYS = [
  'buildingLarge1', 'buildingLarge2', 'buildingLarge3', 'buildingLarge4', 'buildingLarge5',
  'buildingSmall1', 'buildingSmall2', 'buildingSmall3',
] as const;

export const BUILDING_TYPE_MODEL = {
  apartments: 'buildingLarge2',
  school: 'buildingLarge1',
  hospital: 'buildingLarge3',
} as const;

// Rough real-world scale correction per asset — these packs aren't all authored at
// the same unit scale. Measured from each file's raw accessor bounding box
// (scripts/inspect-glb) — nudge visually once you can see the render.
export const MODEL_SCALE: Record<string, number> = {
  bus: 12 / 157.46, // normalize ~157-unit raw mesh down to a ~12m bus
  policeCar: 1,
  suv: 1,
  sportsCar: 1,
  taxi: 1,
  streetLight: 1,
  trafficLight: 1.6, // raw ~2.4m tall, real signal poles run ~3.5-4m
  tree1: 1,
  tree2: 1,
  tree3: 1.6,
  treeCluster: 1,

  // Kenney city-kit buildings render at raw ~2-3.5m (toy-kit scale) — bumped up
  // to feel like real building blocks. Large variants get a bit more height.
  buildingLarge1: 4.5,
  buildingLarge2: 4.5,
  buildingLarge3: 4.5,
  buildingLarge4: 4.5,
  buildingLarge5: 4.5,
  buildingSmall1: 3.8,
  buildingSmall2: 3.8,
  buildingSmall3: 3.8,
  townCenter: 1,

  // No baked node-scale on this one and raw mesh is ~41 units long — normalize
  // down to a ~6m charging canopy.
  chargingStation: 6 / 41.27,

  // Park-kit props already carry their own ×100 node scale (render near real
  // meters out of the box).
  parkBench: 1,
  parkBird: 1,
  parkBushLarge: 1,
  parkBush: 1,
  parkFountain: 1,
  parkGrassA: 1,
  parkGrassB: 1,
  parkHedgeCorner: 1,
  parkHedgeLong: 1,
  parkHedge: 1,
  parkLantern: 1,
  parkTrashcan: 1,
  parkTreeLarge: 1,
  parkTree: 1,
  parkFlowerA: 1,
  parkFlowerB: 1,
  parkFloorA: 1,
  parkCobble: 1,

  // Raw bbox ~20m across, no node-scale — already close to real roundabout scale.
  roundabout: 1,
};

// If a model's forward axis doesn't match travel direction once you can see it
// rendered, add a correction here (radians) rather than fighting the math.
export const MODEL_YAW_OFFSET: Record<string, number> = {
  bus: 0,
  policeCar: 0,
  suv: 0,
  sportsCar: 0,
  taxi: 0,
};
