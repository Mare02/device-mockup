"use client";

import { useState, useCallback, memo, useEffect } from "react";
import JSZip from "jszip";
import {
  Download,
  MonitorSmartphone,
  Upload,
  Save,
  Copy,
  Check,
  Plus,
  Minus,
  X,
  Pipette,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// removed useAuth import

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SCREENS = 10;

const GRADIENTS = [
  "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
  "bg-gradient-to-r from-cyan-500 to-blue-500",
  "bg-gradient-to-tr from-emerald-500 to-teal-400",
  "bg-gradient-to-br from-orange-400 to-rose-400",
  "bg-gradient-to-r from-violet-600 to-indigo-600",
  "bg-zinc-900",
  "bg-white",
];

const DEVICE_MODELS = [
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImgProps = { scale: number; x: number; y: number; rotate: number };

type MockupFrame = {
  id: string;
  /** base64 data-URL (never a long-lived blob URL) */
  image: string | null;
  gradient: string;
  imgProps: ImgProps;
};

type DeviceModel = (typeof DEVICE_MODELS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an HTMLImageElement to a CSS gradient colour stop array */
function parseTailwindGradient(gradient: string): readonly [string, string, string] {
  // Fallback mappings for the preset gradients
  const presets: Record<string, [string, string, string]> = {
    "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500": ["#6366f1", "#a855f7", "#ec4899"],
    "bg-gradient-to-r from-cyan-500 to-blue-500": ["#06b6d4", "#06b6d4", "#3b82f6"],
    "bg-gradient-to-tr from-emerald-500 to-teal-400": ["#10b981", "#10b981", "#2dd4bf"],
    "bg-gradient-to-br from-orange-400 to-rose-400": ["#fb923c", "#fb923c", "#fb7185"],
    "bg-gradient-to-r from-violet-600 to-indigo-600": ["#7c3aed", "#7c3aed", "#4f46e5"],
    "bg-zinc-900": ["#18181b", "#18181b", "#18181b"],
    "bg-white": ["#ffffff", "#ffffff", "#ffffff"],
  };
  return presets[gradient] ?? ["#6366f1", "#a855f7", "#ec4899"];
}

/**
 * Converts a File to a base64 data-URL without any downscaling or re-encoding.
 */
async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Canvas-based exportRenderer
// ---------------------------------------------------------------------------

/**
 * Renders all frames onto a single HTMLCanvasElement and returns it.
 * This replaces the `modern-screenshot` dependency entirely.
 */
async function renderMockupToCanvas(
  frames: MockupFrame[],
  model: DeviceModel,
  settings: { padding: number; gap: number; shadow: number; scale: number }
): Promise<HTMLCanvasElement> {
  const s = settings.scale / 100;
  const phoneW = model.width * s;
  const phoneH = model.height * s;
  const radius = model.radius * s;
  const bezel = model.bezel * s;
  const screenRadius = Math.max(radius - bezel, 4);
  const safeShadow = Math.min(settings.shadow, 20); // clamp GPU expense

  const cellW = phoneW + settings.padding * 2;
  const cellH = phoneH + settings.padding * 2;
  const totalW = cellW * frames.length + settings.gap * (frames.length - 1);
  const totalH = cellH;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(totalW);
  canvas.height = Math.round(totalH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  // Pre-load images
  const bitmaps: (ImageBitmap | null)[] = await Promise.all(
    frames.map(async (frame) => {
      if (!frame.image) return null;
      try {
        const res = await fetch(frame.image);
        const blob = await res.blob();
        return await createImageBitmap(blob);
      } catch {
        return null;
      }
    })
  );

  frames.forEach((frame, i) => {
    const offsetX = i * (cellW + settings.gap);
    const offsetY = 0;

    // ---- Background (cell) ----
    const colors = parseTailwindGradient(frame.gradient);
    if (frame.gradient.startsWith("#")) {
      ctx.fillStyle = frame.gradient;
      ctx.fillRect(offsetX, offsetY, cellW, cellH);
    } else if (colors[0] === colors[2]) {
      ctx.fillStyle = colors[0];
      ctx.fillRect(offsetX, offsetY, cellW, cellH);
    } else {
      const grad = ctx.createLinearGradient(offsetX, offsetY, offsetX + cellW, offsetY + cellH);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(0.5, colors[1]);
      grad.addColorStop(1, colors[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(offsetX, offsetY, cellW, cellH);
    }

    // ---- Phone outer body ----
    const phoneX = offsetX + settings.padding;
    const phoneY = offsetY + settings.padding;

    // Shadow
    if (safeShadow > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${Math.min(safeShadow / 100, 0.8)})`;
      ctx.shadowBlur = safeShadow * 3;
      ctx.shadowOffsetY = safeShadow;
    }

    // Outer shell
    ctx.beginPath();
    ctx.roundRect(phoneX, phoneY, phoneW, phoneH, radius);
    ctx.fillStyle = "#000";
    ctx.fill();
    if (safeShadow > 0) ctx.restore();

    // Ring highlight
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(phoneX, phoneY, phoneW, phoneH, radius);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // ---- Hardware buttons ----
    const btnW = Math.max(2, 4 * s);
    const powerH = 48 * s;
    const volH = 64 * s;
    ctx.fillStyle = "#3f3f46";
    // Power button (right side)
    ctx.fillRect(phoneX + phoneW - 1, phoneY + phoneH * 0.25, btnW, powerH);
    // Volume up (left)
    ctx.fillRect(phoneX - btnW + 1, phoneY + phoneH * 0.25, btnW, volH);
    // Volume down (left)
    ctx.fillRect(phoneX - btnW + 1, phoneY + phoneH * 0.35, btnW, volH);

    // ---- Screen area ----
    const screenX = phoneX + bezel;
    const screenY = phoneY + bezel;
    const screenW = phoneW - bezel * 2;
    const screenH = phoneH - bezel * 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
    ctx.clip();

    // Screen fill (dark background)
    ctx.fillStyle = "#09090b";
    ctx.fill();

    // ---- Screenshot image (object-fit: cover) ----
    const bmp = bitmaps[i];
    if (bmp) {
      ctx.save();
      const { scale: imgScale, x: imgX, y: imgY, rotate: imgRotate } = frame.imgProps;
      const cx = screenX + screenW / 2;
      const cy = screenY + screenH / 2;

      // Replicate CSS object-fit:cover — scale so the image fills the screen
      // on both axes, preserving aspect ratio (crop, not squish).
      const coverScale = Math.max(screenW / bmp.width, screenH / bmp.height);
      const drawW = bmp.width * coverScale;
      const drawH = bmp.height * coverScale;

      ctx.translate(cx + imgX, cy + imgY);
      ctx.rotate((imgRotate * Math.PI) / 180);
      ctx.scale(imgScale / 100, imgScale / 100);
      // Draw centered so the covered area is centred in the screen
      ctx.drawImage(bmp, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    // ---- Notch / Island overlay ----
    const notchType = model.notchType;
    if (notchType === "dynamic-island") {
      const islandW = 120 * s;
      const islandH = 34 * s;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.roundRect(
        screenX + (screenW - islandW) / 2,
        screenY + 8 * s,
        islandW,
        islandH,
        islandH / 2
      );
      ctx.fill();
    } else if (notchType === "notch") {
      const notchW = 160 * s;
      const notchH = 30 * s;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.roundRect(screenX + (screenW - notchW) / 2, screenY, notchW, notchH, [0, 0, 12 * s, 12 * s]);
      ctx.fill();
    } else if (notchType === "punch-hole") {
      const holeR = 10 * s;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(screenX + screenW / 2, screenY + holeR * 2, holeR, 0, Math.PI * 2);
      ctx.fill();
    } else if (notchType === "home-button") {
      // Top bezel area (speaker)
      const bezelH = 60 * s;
      ctx.fillStyle = "#000";
      ctx.fillRect(screenX, screenY, screenW, bezelH);

      const speakerW = 40 * s;
      const speakerH = 6 * s;
      ctx.fillStyle = "#18181b";
      ctx.beginPath();
      ctx.roundRect(
        screenX + (screenW - speakerW) / 2,
        screenY + (bezelH - speakerH) / 2,
        speakerW,
        speakerH,
        speakerH / 2
      );
      ctx.fill();

      // Bottom bezel area (Home Button)
      ctx.fillStyle = "#000";
      ctx.fillRect(screenX, screenY + screenH - bezelH, screenW, bezelH);

      const btnR = 24 * s;
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.arc(screenX + screenW / 2, screenY + screenH - bezelH / 2, btnR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore(); // end screen clip
  });

  // Close bitmaps to free GPU memory
  bitmaps.forEach((bmp) => bmp?.close());

  return canvas;
}

// ---------------------------------------------------------------------------
// Memoised Frame component (prevents re-renders of sibling frames)
// ---------------------------------------------------------------------------

type FrameProps = {
  frame: MockupFrame;
  index: number;
  activeModel: DeviceModel & { width: number; height: number; radius: number; bezel: number };
  s: number;
  padding: number;
  shadow: number;
  showRemove: boolean;
  isActiveSettings: boolean;
  onRemove: () => void;
  onClearImage: () => void;
  onToggleSettings: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGradient: (g: string) => void;
  onUpdateImgProps: (props: Partial<ImgProps>) => void;
};

const Frame = memo(function Frame({
  frame,
  index,
  activeModel,
  s,
  padding,
  shadow,
  showRemove,
  isActiveSettings,
  onRemove,
  onClearImage,
  onToggleSettings,
  onUpload,
  onGradient,
  onUpdateImgProps,
}: FrameProps) {
  const safeShadow = Math.min(shadow, 20);

  const renderNotch = (type: string) => {
    switch (type) {
      case "dynamic-island":
        return (
          <div
            className="absolute inset-x-0 w-full flex justify-center z-10 pointer-events-none"
            style={{ top: `${8 * s}px` }}
          >
            <div
              className="bg-black rounded-full flex items-center justify-end"
              style={{
                width: `${120 * s}px`,
                height: `${34 * s}px`,
                paddingRight: `${12 * s}px`,
              }}
            >
              <div
                className="rounded-full bg-zinc-800/80 border border-white/5"
                style={{
                  width: `${12 * s}px`,
                  height: `${12 * s}px`,
                }}
              />
            </div>
          </div>
        );
      case "notch":
        return (
          <div
            className="absolute top-0 inset-x-0 w-full flex justify-center z-10 pointer-events-none"
          >
            <div
              className="bg-black"
              style={{
                width: `${160 * s}px`,
                height: `${30 * s}px`,
                borderBottomLeftRadius: `${24 * s}px`,
                borderBottomRightRadius: `${24 * s}px`,
              }}
            />
          </div>
        );
      case "punch-hole":
        return (
          <div
            className="absolute inset-x-0 w-full flex justify-center z-10 pointer-events-none"
            style={{ top: `${20 * s}px` }}
          >
            <div
              className="bg-black rounded-full border border-zinc-800"
              style={{
                width: `${20 * s}px`,
                height: `${20 * s}px`,
              }}
            />
          </div>
        );
      case "home-button":
        return (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between">
            {/* Top Speaker Bezel */}
            <div
              className="w-full bg-black flex items-center justify-center"
              style={{ height: `${60 * s}px` }}
            >
              <div
                className="bg-zinc-800 rounded-full"
                style={{ width: `${40 * s}px`, height: `${6 * s}px` }}
              />
            </div>
            {/* Bottom Home Button Bezel */}
            <div
              className="w-full bg-black flex items-center justify-center"
              style={{ height: `${60 * s}px` }}
            >
              <div
                className="rounded-full border border-zinc-700"
                style={{ width: `${48 * s}px`, height: `${48 * s}px` }}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative group shrink-0 transition-all duration-300 hover:-translate-y-1">
      {/* Frame Actions (Excluded from Export) */}
      {/* Frame Actions (Excluded from Export) */}
      <div className="exclude-from-export opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity absolute -top-12 inset-x-0 flex justify-center gap-2 z-30">
        {showRemove && (
          <Button
            size="icon"
            variant="outline"
            title="Remove Screen"
            className="h-8 w-8 rounded-full border-white border-2! text-destructive hover:bg-destructive hover:text-white bg-white dark:bg-zinc-950 shadow-md"
            onClick={onRemove}
          >
            <Minus className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          title="Settings"
          className={`h-8 w-8 rounded-full bg-background ${isActiveSettings ? "border-primary text-primary" : ""}`}
          onClick={onToggleSettings}
        >
          <Settings2 className="w-4 h-4" />
        </Button>
        {frame.image && (
          <Button
            size="icon"
            variant="destructive"
            title="Remove Image"
            className="h-8 w-8 rounded-full"
            onClick={onClearImage}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="secondary"
          title="Upload Image"
          className="h-8 w-8 rounded-full cursor-pointer relative overflow-hidden"
          asChild
        >
          <label>
            <Upload className="w-4 h-4" />
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        </Button>
      </div>


      {/* Screen Canvas Background */}
      <div
        className={`flex items-center justify-center transition-colors ${
          frame.gradient.startsWith("bg-") ? frame.gradient : ""
        }`}
        style={{
          padding: `${padding}px`,
          backgroundColor: !frame.gradient.startsWith("bg-") ? frame.gradient : undefined,
        }}
      >
        {/* Phone Model Container */}
        <div
          className="bg-black relative flex flex-col overflow-hidden ring-[1px] ring-white/10"
          style={{
            width: `${activeModel.width}px`,
            height: `${activeModel.height}px`,
            borderRadius: `${activeModel.radius}px`,
            padding: `${activeModel.bezel}px`,
            boxShadow: `0px ${safeShadow}px ${safeShadow * 1.5}px -10px rgba(0,0,0,${Math.min(safeShadow / 100, 0.8)})`,
          }}
        >
          {/* Hardware Details */}
          <div
            className="absolute top-1/4 -right-1 bg-zinc-800 rounded-l-sm"
            style={{ width: `${Math.max(2, 4 * s)}px`, height: `${48 * s}px` }}
          />
          <div
            className="absolute top-1/4 -left-1 bg-zinc-800 rounded-r-sm"
            style={{ width: `${Math.max(2, 4 * s)}px`, height: `${64 * s}px` }}
          />
          <div
            className="absolute top-[35%] -left-1 bg-zinc-800 rounded-r-sm"
            style={{ width: `${Math.max(2, 4 * s)}px`, height: `${64 * s}px` }}
          />

          {/* Screen Area */}
          <div
            className="w-full h-full relative overflow-hidden bg-zinc-950 flex flex-col items-center justify-center"
            style={{ borderRadius: `${Math.max(activeModel.radius - activeModel.bezel, 4)}px` }}
          >
            {renderNotch(activeModel.notchType)}

            {!frame.image ? (
              <label className="exclude-from-export cursor-pointer flex flex-col items-center justify-center w-full h-full hover:bg-zinc-900 transition-colors">
                <MonitorSmartphone className="w-12 h-12 text-zinc-600 mb-4" />
                <span className="text-zinc-500 font-medium">Click to upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
              </label>
            ) : (
              <img
                src={frame.image}
                alt={`Screen ${index + 1}`}
                className="w-full h-full object-cover block absolute inset-0 pointer-events-none"
                style={{
                  transform: `translate(${frame.imgProps.x}px, ${frame.imgProps.y}px) scale(${frame.imgProps.scale / 100}) rotate(${frame.imgProps.rotate}deg)`,
                  transformOrigin: "center center",
                }}
              />
            )}
          </div>
        </div>

        {/* Image Settings Side Panel / Mobile Overlay */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isActiveSettings
              ? "fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/20 md:relative md:inset-auto md:z-0 md:bg-transparent md:flex md:items-center md:p-0 md:w-72 md:ml-6 md:opacity-100"
              : "hidden"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) onToggleSettings();
          }}
        >
          <div className="w-full max-w-sm md:w-72 bg-background/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col text-xs animate-in slide-in-from-bottom md:slide-in-from-left duration-300 max-h-[50vh]">
            {/* Header (Sticky) */}
            <div className="flex justify-between items-center p-5 pb-3 border-b border-border/30 sticky top-0 z-10 bg-background/95 backdrop-blur-md rounded-t-3xl">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <span className="font-bold text-foreground uppercase tracking-widest text-[10px]">Settings</span>
              </div>
              <button
                onClick={onToggleSettings}
                className="text-muted-foreground hover:text-foreground p-1.5 -mr-1.5 rounded-full hover:bg-muted/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-5 flex flex-col gap-5 overflow-y-auto">
              {frame.image && (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Scale</Label>
                      <span className="bg-primary/10 text-primary px-2 rounded-md font-mono">{frame.imgProps.scale}%</span>
                    </div>
                    <Slider
                      min={10}
                      max={300}
                      step={1}
                      value={[frame.imgProps.scale]}
                      onValueChange={([v]: number[]) => onUpdateImgProps({ scale: v })}
                      className="py-1 cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Horizontal Position</Label>
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 rounded-md font-mono">{frame.imgProps.x}px</span>
                    </div>
                    <Slider
                      min={-1000}
                      max={1000}
                      step={1}
                      value={[frame.imgProps.x]}
                      onValueChange={([v]: number[]) => onUpdateImgProps({ x: v })}
                      className="py-1"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Vertical Position</Label>
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 rounded-md font-mono">{frame.imgProps.y}px</span>
                    </div>
                    <Slider
                      min={-1000}
                      max={1000}
                      step={1}
                      value={[frame.imgProps.y]}
                      onValueChange={([v]: number[]) => onUpdateImgProps({ y: v })}
                      className="py-1"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between text-muted-foreground font-medium">
                      <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Rotation</Label>
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 rounded-md font-mono">{frame.imgProps.rotate}°</span>
                    </div>
                    <Slider
                      min={-180}
                      max={180}
                      step={1}
                      value={[frame.imgProps.rotate]}
                      onValueChange={([v]: number[]) => onUpdateImgProps({ rotate: v })}
                      className="py-1"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3">
                <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Background Color</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENTS.map((g, idx) => (
                    <button
                      key={idx}
                      className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                        g === frame.gradient ? "border-primary scale-110 shadow-sm" : "border-muted/50 hover:border-primary/50"
                      } ${g}`}
                      onClick={() => onGradient(g)}
                    />
                  ))}
                  <div
                    className={`relative w-6 h-6 rounded-full overflow-hidden border-2 shrink-0 transition-all flex items-center justify-center ${
                      !frame.gradient.startsWith("bg-")
                        ? "border-primary scale-110 shadow-sm"
                        : "border-muted/50 hover:border-primary/50"
                    }`}
                  >
                    <Pipette className="w-3 h-3 text-white absolute pointer-events-none z-10 mix-blend-difference" />
                    <input
                      type="color"
                      className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
                      value={!frame.gradient.startsWith("bg-") ? frame.gradient : "#e2e8f0"}
                      onChange={(e) => onGradient(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[10px] h-9 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all font-bold uppercase tracking-widest"
                  onClick={() => onUpdateImgProps({ scale: 100, x: 0, y: 0, rotate: 0 })}
                >
                  Reset Transform
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating tools (Desktop only hover) */}
        <div className="exclude-from-export hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-10 inset-x-0 justify-center gap-1.5 z-30 flex-wrap px-2">
          {GRADIENTS.map((g, idx) => (
            <button
              key={idx}
              className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                g === frame.gradient ? "border-primary scale-125 shadow-sm" : "border-muted/50 hover:border-primary/50"
              } ${g}`}
              onClick={() => onGradient(g)}
            />
          ))}
          {/* Custom Color Input */}
          <div
            className={`relative w-6 h-6 rounded-full overflow-hidden border-2 shrink-0 transition-all flex items-center justify-center ${
              !frame.gradient.startsWith("bg-")
                ? "border-primary scale-125 shadow-sm"
                : "border-muted/50 hover:border-primary/50"
            }`}
          >
            <Pipette className="w-3 h-3 text-white absolute pointer-events-none z-10 mix-blend-difference" />
            <input
              type="color"
              className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
              value={!frame.gradient.startsWith("bg-") ? frame.gradient : "#e2e8f0"}
              onChange={(e) => onGradient(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DeviceMockup() {
  const [frames, setFrames] = useState<MockupFrame[]>([
    {
      id: "1",
      image: null,
      gradient: "bg-white",
      imgProps: { scale: 100, x: 0, y: 0, rotate: 0 },
    },
  ]);
  const [activeSettingsFrame, setActiveSettingsFrame] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [modelId, setModelId] = useState("iphone-island");
  const [padding, setPadding] = useState(64);
  const [gap, setGap] = useState(32);
  const [shadow, setShadow] = useState(30);
  const [scale, setScale] = useState(80);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  // const { isLoaded, isSignedIn } = useAuth(); // removed clerk

  const rawModel = DEVICE_MODELS.find((m) => m.id === modelId) || DEVICE_MODELS[0];
  const s = scale / 100;
  const activeModel = {
    ...rawModel,
    width: rawModel.width * s,
    height: rawModel.height * s,
    radius: rawModel.radius * s,
    bezel: rawModel.bezel * s,
  };

  // ---- Navigation Guards ----
  const hasDiscardableWork =
    frames.length > 1 ||
    frames.some(
      (f) =>
        f.image !== null ||
        f.gradient !== "bg-white" ||
        f.imgProps.scale !== 100 ||
        f.imgProps.x !== 0 ||
        f.imgProps.y !== 0 ||
        f.imgProps.rotate !== 0
    ) ||
    padding !== 64 ||
    gap !== 32 ||
    shadow !== 30 ||
    scale !== 80 ||
    modelId !== "iphone-island";

  useEffect(() => {
    if (!hasDiscardableWork) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Standard way to trigger browser prompt
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDiscardableWork]);

  // ---- Image Upload (downscale + store as base64) ----
  const handleImageUpload = useCallback(
    async (frameId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataURL(file);
        setFrames((prev) =>
          prev.map((f) => (f.id === frameId ? { ...f, image: dataUrl } : f))
        );
      } catch (err) {
        console.error("Image processing failed", err);
      }
    },
    []
  );

  const addFrame = useCallback(() => {
    setFrames((prev) => {
      if (prev.length >= MAX_SCREENS) return prev;
      return [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          image: null,
          gradient: "bg-white",
          imgProps: { scale: 100, x: 0, y: 0, rotate: 0 },
        },
      ];
    });
  }, []);

  const removeFrame = useCallback((frameId: string) => {
    setFrames((prev) => {
      const frame = prev.find(f => f.id === frameId);
      if (frame?.image) {
        setDeleteConfirmId(frameId);
        return prev; // don't remove yet
      }
      if (prev.length <= 1) return prev;
      return prev.filter((f) => f.id !== frameId);
    });
  }, []);

  const confirmRemoveFrame = useCallback(() => {
    if (!deleteConfirmId) return;
    setFrames((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((f) => f.id !== deleteConfirmId);
    });
    setDeleteConfirmId(null);
  }, [deleteConfirmId]);

  const clearImage = useCallback((frameId: string) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === frameId ? { ...f, image: null } : f))
    );
  }, []);

  const setFrameGradient = useCallback((frameId: string, gradient: string) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === frameId ? { ...f, gradient } : f))
    );
  }, []);

  const updateImgProps = useCallback(
    (frameId: string, props: Partial<ImgProps>) => {
      setFrames((prev) =>
        prev.map((f) =>
          f.id === frameId ? { ...f, imgProps: { ...f.imgProps, ...props } } : f
        )
      );
    },
    []
  );

  const toggleSettings = useCallback((frameId: string) => {
    setActiveSettingsFrame((cur) => (cur === frameId ? null : frameId));
  }, []);

  // ---- Canvas export ----
  const getExportCanvas = useCallback(async () => {
    return renderMockupToCanvas(frames, rawModel, {
      padding,
      gap,
      shadow,
      scale,
    });
  }, [frames, rawModel, padding, gap, shadow, scale]);

  const handleExport = useCallback(
    async (format: "png" | "jpeg") => {
      setIsExporting(true);
      try {
        const mimeType = format === "png" ? "image/png" : "image/jpeg";

        if (frames.length === 1) {
          const canvas = await renderMockupToCanvas([frames[0]], rawModel, {
            padding,
            gap,
            shadow,
            scale,
          });
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mimeType, 0.92));
          if (!blob) throw new Error("Failed to create image blob");

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `mockup-${Date.now()}.${format}`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const zip = new JSZip();
          await Promise.all(
            frames.map(async (frame, i) => {
              const canvas = await renderMockupToCanvas([frame], rawModel, {
                padding,
                gap,
                shadow,
                scale,
              });
              const blob = await new Promise<Blob | null>((res) =>
                canvas.toBlob(res, mimeType, 0.92)
              );
              if (blob) {
                zip.file(`screen-${i + 1}.${format}`, blob);
              }
            })
          );

          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const link = document.createElement("a");
          link.download = `screens-export-${Date.now()}.zip`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (err) {
        console.error("Export failed", err);
      } finally {
        setIsExporting(false);
      }
    },
    [frames, rawModel, padding, gap, shadow, scale]
  );

  const copyToClipboard = useCallback(async () => {
    setIsExporting(true);
    try {
      const canvas = await getExportCanvas();
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png")
      );
      if (!blob) throw new Error("Blob creation failed");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    } finally {
      setIsExporting(false);
    }
  }, [getExportCanvas]);

  // removed handleSave

  const hasImages = frames.some((f) => !!f.image);
  const canAddMore = frames.length < MAX_SCREENS;

  return (
    <div className="container mx-auto px-4 max-w-full">
      <div className="flex flex-col gap-8">
        {/* Mobile Settings Toggle */}
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-2xl flex items-center justify-center p-0"
            onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
          >
            {isMobileSettingsOpen ? <X size={24} /> : <Settings2 size={24} />}
          </Button>
        </div>

        {/* Editor Settings (Desktop & Mobile Drawer) */}
        <div className={`w-full container mx-auto px-4 ${isMobileSettingsOpen ? 'fixed inset-0 z-40 flex flex-col justify-end p-4' : 'hidden md:block'}`}>
          {isMobileSettingsOpen && (
            <div className="fixed inset-0 bg-zinc-950 -z-10" onClick={() => setIsMobileSettingsOpen(false)} />
          )}
          <Card className={`${isMobileSettingsOpen ? 'max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-500 shadow-2xl-strong border-t-2 border-primary/20' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl">Settings</CardTitle>
              {isMobileSettingsOpen && (
                <Button variant="ghost" size="icon" onClick={() => setIsMobileSettingsOpen(false)}>
                  <X size={20} />
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="space-y-3">
                <Label>Device Model</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Phones</SelectLabel>
                      {DEVICE_MODELS.filter(m => m.category === "Phones").map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Tablets</SelectLabel>
                      {DEVICE_MODELS.filter(m => m.category === "Tablets").map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="flex justify-between">
                  <span>Padding</span>
                  <span className="text-muted-foreground">{padding}px</span>
                </Label>
                <Slider
                  value={[padding]}
                  onValueChange={([v]: number[]) => setPadding(v)}
                  onValueCommit={([v]: number[]) => setPadding(v)}
                  max={200}
                  step={4}
                />
              </div>

              <div className="space-y-3">
                <Label className="flex justify-between">
                  <span>Gap Between Screens</span>
                  <span className="text-muted-foreground">{gap}px</span>
                </Label>
                <Slider
                  value={[gap]}
                  onValueChange={([v]: number[]) => setGap(v)}
                  onValueCommit={([v]: number[]) => setGap(v)}
                  max={200}
                  step={4}
                />
              </div>

              <div className="space-y-3">
                <Label className="flex justify-between">
                  <span>Shadow</span>
                  <span className="text-muted-foreground">{shadow}%</span>
                </Label>
                <Slider
                  value={[shadow]}
                  onValueChange={([v]: number[]) => setShadow(v)}
                  onValueCommit={([v]: number[]) => setShadow(v)}
                  max={100}
                  step={5}
                />
              </div>

              <div className="space-y-3">
                <Label className="flex justify-between">
                  <span>Scale</span>
                  <span className="text-muted-foreground">{scale}%</span>
                </Label>
                <Slider
                  value={[scale]}
                  onValueChange={([v]: number[]) => setScale(v)}
                  onValueCommit={([v]: number[]) => setScale(v)}
                  min={30}
                  max={120}
                  step={5}
                />
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-5 pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t">
                <div className="flex gap-2">
                  <Button
                    className="flex-1 sm:flex-auto"
                    onClick={() => handleExport("png")}
                    disabled={isExporting || !hasImages}
                  >
                    <Download className="w-4 h-4 mr-2" /> PNG
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-auto"
                    onClick={() => handleExport("jpeg")}
                    disabled={isExporting || !hasImages}
                  >
                    <Download className="w-4 h-4 mr-2" /> JPG
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 sm:flex-auto"
                    onClick={copyToClipboard}
                    disabled={isExporting || !hasImages}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Canvas Area */}
        <div className="w-full flex flex-col items-center justify-start border border-border rounded-xl shadow-sm p-4 bg-zinc-50/50 dark:bg-zinc-950/20 relative">
          <div className="w-full overflow-x-auto overflow-y-visible p-2 pb-16 pt-16">
            <div
              className="transition-all duration-300 flex items-center w-max mx-auto px-2"
              style={{ gap: `${gap}px` }}
            >
              {frames.map((frame, index) => (
                <Frame
                  key={frame.id}
                  frame={frame}
                  index={index}
                  activeModel={activeModel}
                  s={s}
                  padding={padding}
                  shadow={shadow}
                  showRemove={frames.length > 1}
                  isActiveSettings={activeSettingsFrame === frame.id}
                  onRemove={() => removeFrame(frame.id)}
                  onClearImage={() => clearImage(frame.id)}
                  onToggleSettings={() => toggleSettings(frame.id)}
                  onUpload={(e) => handleImageUpload(frame.id, e)}
                  onGradient={(g) => setFrameGradient(frame.id, g)}
                  onUpdateImgProps={(props) => updateImgProps(frame.id, props)}
                />
              ))}

              {/* Inline Add Screen Button */}
              {canAddMore && (
                <div className="exclude-from-export flex flex-col justify-center items-center shrink-0 ml-4 mb-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-16 w-16 rounded-full border-dashed border-2 border-white opacity-100 transition-opacity bg-background hover:bg-muted shadow-md"
                    onClick={addFrame}
                    title={`Add screen (${frames.length}/${MAX_SCREENS})`}
                  >
                    <Plus className="w-8 h-8 text-foreground" />
                  </Button>
                  <span className="text-xs text-muted-foreground mt-1">
                    {frames.length}/{MAX_SCREENS}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 animate-in fade-in duration-200" onClick={() => setDeleteConfirmId(null)}>
          <Card 
            className="w-full max-w-[400px] shadow-2xl border-destructive/20 animate-in zoom-in-95 duration-200 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl font-bold">Are you sure?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <p className="text-center text-muted-foreground">
                This frame contains an image. Removing it will permanently delete your work on this screen.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  variant="destructive" 
                  size="lg" 
                  onClick={confirmRemoveFrame}
                  className="w-full font-bold h-12 shadow-sm"
                >
                  Yes, remove device
                </Button>
                <Button 
                  variant="ghost" 
                  size="lg" 
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full font-medium"
                >
                  No, keep it
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
