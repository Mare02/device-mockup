import type { DeviceModel } from "./types";

export const MAX_ELEMENTS = 20;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
export const ZOOM_SENSITIVITY = 0.001;
export const ZOOM_BUTTON_STEP = 1.15; // 15% per button click

export const MIN_ELEMENT_SIZE = 80;
export const DEFAULT_PADDING = 64;
export const DEFAULT_SHADOW = 30;
export const DEFAULT_SCALE_FACTOR = 0.6;
export const TOP_EXTRA_PADDING = 120; // Room for titles/subtitles

export const GRADIENTS = [
  "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
  "bg-gradient-to-r from-cyan-500 to-blue-500",
  "bg-gradient-to-tr from-emerald-500 to-teal-400",
  "bg-gradient-to-br from-orange-400 to-rose-400",
  "bg-gradient-to-r from-violet-600 to-indigo-600",
  "bg-zinc-900",
  "bg-white",
];

/** Map Tailwind gradient class strings → actual CSS hex stops */
export const GRADIENT_COLORS: Record<string, [string, string, string]> = {
  "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500": [
    "#6366f1",
    "#a855f7",
    "#ec4899",
  ],
  "bg-gradient-to-r from-cyan-500 to-blue-500": [
    "#06b6d4",
    "#06b6d4",
    "#3b82f6",
  ],
  "bg-gradient-to-tr from-emerald-500 to-teal-400": [
    "#10b981",
    "#10b981",
    "#2dd4bf",
  ],
  "bg-gradient-to-br from-orange-400 to-rose-400": [
    "#fb923c",
    "#fb923c",
    "#fb7185",
  ],
  "bg-gradient-to-r from-violet-600 to-indigo-600": [
    "#7c3aed",
    "#7c3aed",
    "#4f46e5",
  ],
  "bg-zinc-900": ["#18181b", "#18181b", "#18181b"],
  "bg-white": ["#ffffff", "#ffffff", "#ffffff"],
};

export const DEVICE_MODELS: DeviceModel[] = [
  {
    id: "iphone-island",
    name: "iPhone Notch Island",
    width: 393,
    height: 852,
    radius: 48,
    bezel: 14,
    notchType: "dynamic-island",
    category: "Phones",
  },
  {
    id: "iphone-notch",
    name: "iPhone Classic Notch",
    width: 390,
    height: 844,
    radius: 46,
    bezel: 16,
    notchType: "notch",
    category: "Phones",
  },
  {
    id: "iphone-classic",
    name: "iPhone (Home Button)",
    width: 375,
    height: 750,
    radius: 44,
    bezel: 12,
    notchType: "home-button",
    category: "Phones",
  },
  {
    id: "android-hole",
    name: "Android Hole Cutout",
    width: 412,
    height: 892,
    radius: 40,
    bezel: 12,
    notchType: "punch-hole",
    category: "Phones",
  },
  {
    id: "android-clean",
    name: "Android Notchless",
    width: 400,
    height: 850,
    radius: 24,
    bezel: 8,
    notchType: "none",
    category: "Phones",
  },
  {
    id: "ipad-pro-11",
    name: "iPad Pro 11-inch",
    width: 834,
    height: 1194,
    radius: 32,
    bezel: 24,
    notchType: "none",
    category: "Tablets",
  },
  {
    id: "ipad-pro-12",
    name: "iPad Pro 12.9-inch",
    width: 1024,
    height: 1366,
    radius: 36,
    bezel: 24,
    notchType: "none",
    category: "Tablets",
  },
  {
    id: "ipad-mini",
    name: "iPad Mini",
    width: 744,
    height: 1133,
    radius: 28,
    bezel: 20,
    notchType: "none",
    category: "Tablets",
  },
];
