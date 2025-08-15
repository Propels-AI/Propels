// Shared types and utilities for the demo builder
export interface DemoCapture {
  id: string;
  screenshotBlob: Blob;
  pageUrl: string;
  timestamp: number;
  stepOrder: number;
}

export interface DemoMetadata {
  demoId: string;
  itemSK: string; // METADATA
  ownerId?: string;
  name?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  createdAt?: string;
  updatedAt?: string;
  statusUpdatedAt?: string;
  s3Key?: string;
}

export interface DemoStep {
  id: string;
  demoId: string;
  itemSK: string; // STEP#<lexical_id>
  screenshotUrl: string;
  hotspots: Hotspot[];
  pageUrl: string;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tooltip: string;
  nextStepId?: string;
}

// Utility functions
export const generateId = (): string => {
  return crypto.randomUUID();
};