import { GRADIENT_COLORS, DEVICE_MODELS, DEFAULT_PADDING, DEFAULT_SHADOW, DEFAULT_SCALE_FACTOR, TOP_EXTRA_PADDING } from "./constants";
import type { DeviceModel, DeviceFrameElement } from "./types";

/**
 * Resolve a gradient key (Tailwind class or hex) to three CSS colour stops.
 */
export function resolveGradientColors(
  gradient: string
): readonly [string, string, string] {
  if (gradient.startsWith("#")) return [gradient, gradient, gradient];
  return GRADIENT_COLORS[gradient] ?? ["#6366f1", "#a855f7", "#ec4899"];
}

/**
 * Convert a File to a base64 data-URL without any downscaling.
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Load an HTMLImageElement from a URL (returns a promise).
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate a short random id.
 */
export function randomId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Resolve a model ID to the DeviceModel object.
 */
export function getModel(modelId: string): DeviceModel {
  return DEVICE_MODELS.find((m) => m.id === modelId) || DEVICE_MODELS[0];
}

/**
 * Compute the uniform scale factor for rendering a device frame
 * at a given cell width, based on the model dimensions + base padding.
 */
export function computeFrameScale(
  cellWidth: number,
  model: DeviceModel,
  basePadding: number
): number {
  const baseCellW = model.width + basePadding * 2;
  return cellWidth / baseCellW;
}

/**
 * Create a new device-frame element with proper initial sizing.
 */
export function createDeviceFrameElement(
  modelId: string,
  x: number,
  y: number
): DeviceFrameElement {
  const model = getModel(modelId);
  const basePadding = DEFAULT_PADDING;
  const baseCellW = model.width + basePadding * 2;
  const baseCellH = model.height + basePadding * 2 + TOP_EXTRA_PADDING;
  const w = baseCellW * DEFAULT_SCALE_FACTOR;
  const h = baseCellH * DEFAULT_SCALE_FACTOR;

  return {
    id: randomId(),
    type: "device-frame",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    locked: false,
    modelId,
    screenshot: null,
    gradient: "bg-white",
    imgProps: { scale: 100, x: 0, y: 0, rotate: 0 },
    shadowIntensity: DEFAULT_SHADOW,
    basePadding,
    frameX: 0,
    frameY: 0,
  };
}
