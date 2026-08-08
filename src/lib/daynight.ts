import * as THREE from 'three';

export interface SkyState {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: THREE.Color;
  sunElevation01: number; // 0 = horizon/below, 1 = overhead — also drives the sun arc position
  sunAzimuth01: number; // 0 = east, 1 = west
  isNight: number; // 0 (full day) .. 1 (full night) — smooth, for streetlights/window glow
  starOpacity: number;
}

interface Keyframe {
  hour: number;
  sky: string;
  fog: string;
  ambient: number;
  sunIntensity: number;
  sunColor: string;
  isNight: number;
}

// Anchor points around a 24h clock — interpolated smoothly between neighbors so the
// transition is gradual ("slowly bright / slowly dark"), not a hard cut.
const KEYFRAMES: Keyframe[] = [
  { hour: 0, sky: '#0c1224', fog: '#0c1224', ambient: 0.3, sunIntensity: 0.14, sunColor: '#5a6ea0', isNight: 1 },
  { hour: 5, sky: '#131b30', fog: '#131b30', ambient: 0.32, sunIntensity: 0.16, sunColor: '#5a6ea0', isNight: 1 },
  { hour: 6.5, sky: '#f2966b', fog: '#e8a888', ambient: 0.4, sunIntensity: 0.75, sunColor: '#ffb366', isNight: 0.35 },
  { hour: 8, sky: '#bcd9f0', fog: '#bcd9f0', ambient: 0.65, sunIntensity: 1.15, sunColor: '#fff6e0', isNight: 0 },
  { hour: 12.5, sky: '#cfe8ff', fog: '#d9ecff', ambient: 0.78, sunIntensity: 1.35, sunColor: '#ffffff', isNight: 0 },
  { hour: 17, sky: '#bcd9f0', fog: '#bcd9f0', ambient: 0.6, sunIntensity: 1.0, sunColor: '#fff0d8', isNight: 0 },
  { hour: 18.7, sky: '#f9734f', fog: '#e8896a', ambient: 0.38, sunIntensity: 0.65, sunColor: '#ff7a45', isNight: 0.35 },
  { hour: 20, sky: '#182136', fog: '#182136', ambient: 0.34, sunIntensity: 0.18, sunColor: '#5a6ea0', isNight: 1 },
  { hour: 24, sky: '#0c1224', fog: '#0c1224', ambient: 0.3, sunIntensity: 0.14, sunColor: '#5a6ea0', isNight: 1 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function computeSkyState(hour: number): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].hour && h <= KEYFRAMES[i + 1].hour) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }
  const span = b.hour - a.hour || 1;
  const t = (h - a.hour) / span;
  const ease = t * t * (3 - 2 * t); // smoothstep — gradual, not linear

  const skyColor = new THREE.Color(a.sky).lerp(new THREE.Color(b.sky), ease);
  const fogColor = new THREE.Color(a.fog).lerp(new THREE.Color(b.fog), ease);
  const sunColor = new THREE.Color(a.sunColor).lerp(new THREE.Color(b.sunColor), ease);
  const ambientIntensity = lerp(a.ambient, b.ambient, ease);
  const sunIntensity = lerp(a.sunIntensity, b.sunIntensity, ease);
  const isNight = lerp(a.isNight, b.isNight, ease);

  // Sun/moon arc: rises ~6, peaks ~12.5, sets ~19; outside that a dim moon arcs opposite.
  const daylight = h >= 6 && h <= 19;
  const arcT = daylight ? (h - 6) / 13 : ((h < 6 ? h + 24 : h) - 19) / 11;
  const sunElevation01 = Math.max(0.05, Math.sin(Math.max(0, Math.min(1, arcT)) * Math.PI));
  const sunAzimuth01 = Math.max(0, Math.min(1, arcT));
  const starOpacity = Math.max(0, Math.min(1, (isNight - 0.5) * 2));

  return { skyColor, fogColor, ambientIntensity, sunIntensity, sunColor, sunElevation01, sunAzimuth01, isNight, starOpacity };
}
