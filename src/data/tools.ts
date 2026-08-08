import type { ToolCategory, ToolId, ToolTarget } from '../types';

export interface ToolDef {
  id: ToolId;
  label: string;
  icon: string;
  category: ToolCategory;
  target: ToolTarget;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'roundabout', label: 'Roundabout', icon: '⭕', category: 'Road', target: 'node', hint: 'Click a junction' },
  { id: 'widen', label: 'Widen Road', icon: '↔️', category: 'Road', target: 'edge', hint: 'Click a road' },
  { id: 'trafficLights', label: 'Traffic Lights', icon: '🚦', category: 'Road', target: 'node', hint: 'Click a junction' },
  { id: 'busLane', label: 'Bus Lane', icon: '🚌', category: 'Transit', target: 'edge', hint: 'Click a road' },
  { id: 'apartments', label: 'Apartments', icon: '🏢', category: 'Building', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'park', label: 'Park', icon: '🌳', category: 'Environment', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'evStation', label: 'EV Charger', icon: '⚡', category: 'Environment', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'school', label: 'School', icon: '🏫', category: 'Sandbox', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'hospital', label: 'Hospital', icon: '🏥', category: 'Sandbox', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'lake', label: 'Lake', icon: '🌊', category: 'Sandbox', target: 'ground', hint: 'Click anywhere on the ground' },
];

export const PLOT_ICON: Record<string, string> = {
  apartments: '🏢',
  park: '🌳',
  evStation: '⚡',
  school: '🏫',
  hospital: '🏥',
  lake: '🌊',
};
