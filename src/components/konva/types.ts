// ---------------------------------------------------------------------------
// Shared types for the Konva-based mockup editor
// ---------------------------------------------------------------------------

export type ImgProps = {
  scale: number;
  x: number;
  y: number;
  rotate: number;
};

export type DeviceModel = {
  id: string;
  name: string;
  width: number;
  height: number;
  radius: number;
  bezel: number;
  notchType: string;
  category: string;
};

// ── Element system (Polotno-inspired) ──

/** Common props every canvas element shares */
interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  label?: string;
}

/** A device frame element — renders a phone mockup with optional screenshot */
export interface DeviceFrameElement extends BaseElement {
  type: "device-frame";
  modelId: string;
  screenshot: string | null;
  gradient: string;
  imgProps: ImgProps;
  shadowIntensity: number;
  /** Base padding (px) at 1:1 scale — everything scales uniformly */
  basePadding: number;
  /** Offset of the device frame within the wrapper (x) */
  frameX: number;
  /** Offset of the device frame within the wrapper (y) */
  frameY: number;
}

/** Union of all element types (extend here for text, image, etc.) */
export type CanvasElement = DeviceFrameElement;

