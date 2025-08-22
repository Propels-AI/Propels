export interface DemoCapture {
  id: string;
  screenshotBlob: Blob;
  pageUrl: string;
  timestamp: number;
  stepOrder: number;
  clickX?: number;
  clickY?: number;
  scrollX?: number;
  scrollY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  xNorm?: number;
  yNorm?: number;
}

export interface DemoMetadata {
  demoId: string;
  itemSK: string;
  ownerId?: string;
  name?: string;
  status?: "DRAFT" | "PUBLISHED";
  createdAt?: string;
  updatedAt?: string;
  statusUpdatedAt?: string;
  s3Key?: string;
}

export interface DemoStep {
  id: string;
  demoId: string;
  itemSK: string;
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

export interface StartCaptureMessage {
  type: "START_CAPTURE";
}

export interface StopCaptureMessage {
  type: "STOP_CAPTURE";
}

export interface SaveCaptureSessionMessage {
  type: "SAVE_CAPTURE_SESSION";
  data: DemoCapture[];
}

export interface GetCaptureSessionMessage {
  type: "GET_CAPTURE_SESSION";
}

export interface ClearCaptureSessionMessage {
  type: "CLEAR_CAPTURE_SESSION";
}

export interface CaptureSessionResponse {
  success: boolean;
  data?: DemoCapture[];
  error?: string;
}

export type ChromeMessage =
  | StartCaptureMessage
  | StopCaptureMessage
  | SaveCaptureSessionMessage
  | GetCaptureSessionMessage
  | ClearCaptureSessionMessage;

export const generateId = (): string => {
  return crypto.randomUUID();
};
