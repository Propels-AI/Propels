// Shared types and utilities for the demo builder
export interface DemoCapture {
  id: string;
  screenshotBlob: Blob;
  pageUrl: string;
  timestamp: number;
}

export interface DemoStep {
  id: string;
  screenshotUrl: string;
  hotspots: Hotspot[];
  pageUrl: string;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  tooltip: string;
  nextStepId?: string;
}

// Utility functions
export const generateId = (): string => {
  return crypto.randomUUID();
};
