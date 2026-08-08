import type { ComponentType, SVGProps } from 'react';
import type { ToolCategory, ToolId, ToolTarget } from '../types';
import {
  IconRoundabout,
  IconWiden,
  IconTrafficLight,
  IconBus,
  IconBuilding,
  IconTree,
  IconBolt,
  IconSchool,
  IconHospital,
  IconWater,
} from '../components/icons';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export interface ToolDef {
  id: ToolId;
  label: string;
  icon: Icon;
  category: ToolCategory;
  target: ToolTarget;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'roundabout', label: 'Roundabout', icon: IconRoundabout, category: 'Road', target: 'node', hint: 'Click a junction' },
  { id: 'widen', label: 'Widen Road', icon: IconWiden, category: 'Road', target: 'edge', hint: 'Click a road' },
  { id: 'trafficLights', label: 'Traffic Lights', icon: IconTrafficLight, category: 'Road', target: 'node', hint: 'Click a junction' },
  { id: 'busLane', label: 'Bus Lane', icon: IconBus, category: 'Transit', target: 'edge', hint: 'Click a road' },
  { id: 'apartments', label: 'Apartments', icon: IconBuilding, category: 'Building', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'park', label: 'Park', icon: IconTree, category: 'Environment', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'evStation', label: 'EV Charger', icon: IconBolt, category: 'Environment', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'school', label: 'School', icon: IconSchool, category: 'Sandbox', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'hospital', label: 'Hospital', icon: IconHospital, category: 'Sandbox', target: 'ground', hint: 'Click anywhere on the ground' },
  { id: 'lake', label: 'Lake', icon: IconWater, category: 'Sandbox', target: 'ground', hint: 'Click anywhere on the ground' },
];

export const PLOT_ICON: Record<string, Icon> = {
  apartments: IconBuilding,
  park: IconTree,
  evStation: IconBolt,
  school: IconSchool,
  hospital: IconHospital,
  lake: IconWater,
};
