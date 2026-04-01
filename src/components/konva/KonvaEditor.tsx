"use client";

/**
 * KonvaEditor
 * ───────────
 * Full-featured canvas editor with:
 *  - Element management (add/remove/edit device frames)
 *  - Infinite canvas with pan + zoom
 *  - Floating toolbar (tools, add element, zoom)
 *  - Right sidebar (element properties, image upload, transforms, bg)
 *  - Export (PNG/JPG per-element + zip for multiple)
 *  - Keyboard shortcuts
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type Konva from "konva";
import JSZip from "jszip";
import {
  Download,
  Upload,
  Copy,
  Check,
  Plus,
  X,
  Pipette,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Trash2,
  MonitorSmartphone,
  Maximize2,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
  SquareDashedMousePointer,
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

import { MockupCanvas } from "./MockupCanvas";
import type { CanvasElement, DeviceFrameElement, ImgProps } from "./types";
import {
  DEVICE_MODELS,
  GRADIENTS,
  MAX_ELEMENTS,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_BUTTON_STEP,
} from "./constants";
import {
  fileToDataURL,
  randomId,
  createDeviceFrameElement,
  resolveGradientColors,
  getModel,
  computeFrameScale,
} from "./helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Main editor component
// ─────────────────────────────────────────────────────────────────────────────

export function KonvaEditor() {
  const stageRef = useRef<Konva.Stage | null>(null);

  // ── Element state ──
  const [elements, setElements] = useState<CanvasElement[]>(() => [
    createDeviceFrameElement("iphone-island", 100, 60),
  ]);

  // ── Tool state ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // ── Export state ──
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Confirm dialog ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Derived state ──
  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;
  const selectedDevice =
    selectedElement?.type === "device-frame"
      ? (selectedElement as DeviceFrameElement)
      : null;
  const hasImages = elements.some(
    (el) => el.type === "device-frame" && (el as DeviceFrameElement).screenshot
  );
  const canAddMore = elements.length < MAX_ELEMENTS;

  // ── Navigation guard ──
  const hasWork =
    elements.length > 1 ||
    elements.some((el) => {
      if (el.type === "device-frame") {
        const df = el as DeviceFrameElement;
        return df.screenshot !== null || df.gradient !== "bg-white";
      }
      return false;
    });

  useEffect(() => {
    if (!hasWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasWork]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Delete / Backspace → remove selected
      if (
        (e.code === "Delete" || e.code === "Backspace") &&
        selectedId &&
        !e.repeat
      ) {
        e.preventDefault();
        removeElement(selectedId);
        return;
      }
      // Escape → deselect
      if (e.code === "Escape") {
        setSelectedId(null);
        return;
      }
      // Cmd/Ctrl +/- for zoom
      if ((e.metaKey || e.ctrlKey) && e.code === "Equal") {
        e.preventDefault();
        zoomBy(1);
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "Minus") {
        e.preventDefault();
        zoomBy(-1);
      }
      // Cmd/Ctrl 0 → reset zoom
      if ((e.metaKey || e.ctrlKey) && e.code === "Digit0") {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Element CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const addDeviceFrame = useCallback(
    (modelId = "iphone-island") => {
      if (!canAddMore) return;
      
      const gap = 24; // Small gap between wrappers
      
      setElements((prev) => {
        let nextX = 100;
        let nextY = 60;

        if (prev.length > 0) {
          // Find the rightmost element to place the next one to its right
          const rightmost = prev.reduce((acc, el) => {
            const currentRight = el.x + el.width;
            const accRight = acc.x + acc.width;
            return currentRight > accRight ? el : acc;
          }, prev[0]);

          nextX = rightmost.x + rightmost.width + gap;
          nextY = rightmost.y; // Keep same vertical alignment
        }

        const el = createDeviceFrameElement(modelId, nextX, nextY);
        // After state update, we should select the new element
        // Since we are in the functional update of setElements, we can't call setSelectedId here easily?
        // Actually, we can, but it's better to do it outside or just use the new ID.
        setTimeout(() => setSelectedId(el.id), 0);
        return [...prev, el];
      });
    },
    [canAddMore]
  );

  const removeElement = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      if (
        el?.type === "device-frame" &&
        (el as DeviceFrameElement).screenshot
      ) {
        setDeleteConfirmId(id);
        return;
      }
      setElements((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((e) => e.id !== id);
      });
      if (selectedId === id) setSelectedId(null);
    },
    [elements, selectedId]
  );

  const confirmRemove = useCallback(() => {
    if (!deleteConfirmId) return;
    setElements((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.id !== deleteConfirmId);
    });
    if (selectedId === deleteConfirmId) setSelectedId(null);
    setDeleteConfirmId(null);
  }, [deleteConfirmId, selectedId]);

  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...changes } : el))
      );
    },
    []
  );

  // ── Device-frame specific actions ──

  const handleImageUpload = useCallback(
    async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataURL(file);
        updateElement(id, { screenshot: dataUrl } as any);
      } catch (err) {
        console.error("Image processing failed", err);
      }
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    [updateElement]
  );

  const clearImage = useCallback(
    (id: string) => {
      updateElement(id, { screenshot: null } as any);
    },
    [updateElement]
  );

  const setGradient = useCallback(
    (id: string, gradient: string) => {
      updateElement(id, { gradient } as any);
    },
    [updateElement]
  );

  const updateImgProps = useCallback(
    (id: string, props: Partial<ImgProps>) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== id || el.type !== "device-frame") return el;
          const df = el as DeviceFrameElement;
          return { ...df, imgProps: { ...df.imgProps, ...props } };
        })
      );
    },
    []
  );

  const changeModel = useCallback(
    (id: string, modelId: string) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== id || el.type !== "device-frame") return el;
          const df = el as DeviceFrameElement;
          // Recompute width/height to maintain padding with new model
          const model = getModel(modelId);
          const baseCellW = model.width + df.basePadding * 2;
          const baseCellH = model.height + df.basePadding * 2;
          const currentScale = computeFrameScale(
            df.width,
            getModel(df.modelId),
            df.basePadding
          );
          return {
            ...df,
            modelId,
            width: baseCellW * currentScale,
            height: baseCellH * currentScale,
          };
        })
      );
    },
    []
  );

  // ── Layering ──
  const bringToFront = useCallback((id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const next = [...prev];
      const [el] = next.splice(idx, 1);
      next.push(el);
      return next;
    });
  }, []);

  const sendToBack = useCallback((id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [el] = next.splice(idx, 1);
      next.unshift(el);
      return next;
    });
  }, []);

  const toggleLock = useCallback(
    (id: string) => {
      const el = elements.find((e) => e.id === id);
      if (el) updateElement(id, { locked: !el.locked });
    },
    [elements, updateElement]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Zoom helpers
  // ─────────────────────────────────────────────────────────────────────────

  const zoomBy = useCallback((direction: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        direction > 0
          ? oldScale * ZOOM_BUTTON_STEP
          : oldScale / ZOOM_BUTTON_STEP
      )
    );
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const pointTo = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: center.x - pointTo.x * newScale,
      y: center.y - pointTo.y * newScale,
    });
    stage.batchDraw();
    setZoomLevel(newScale);
  }, []);

  const resetView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    setZoomLevel(1);
  }, []);

  const fitToScreen = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || elements.length === 0) return;

    // Compute bounding box of all elements
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const padding = 60;
    const scaleX = (stage.width() - padding * 2) / contentW;
    const scaleY = (stage.height() - padding * 2) / contentH;
    const newScale = Math.min(scaleX, scaleY, 2); // cap at 2x

    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;

    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: stage.width() / 2 - centerX * newScale,
      y: stage.height() / 2 - centerY * newScale,
    });
    stage.batchDraw();
    setZoomLevel(newScale);
  }, [elements]);

  // ─────────────────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────────────────

  const exportSingleElement = useCallback(
    async (el: CanvasElement, format: "png" | "jpeg") => {
      if (el.type !== "device-frame") return null;
      const df = el as DeviceFrameElement;
      const model = getModel(df.modelId);
      const baseCellW = model.width + df.basePadding * 2;
      const baseCellH = model.height + df.basePadding * 2;

      // Export at 1:1 (native resolution)
      const exportW = baseCellW;
      const exportH = baseCellH;

      const container = document.createElement("div");
      container.style.cssText = "position:absolute;left:-9999px;top:-9999px";
      document.body.appendChild(container);

      const KonvaLib = (await import("konva")).default;
      const tmpStage = new KonvaLib.Stage({
        container,
        width: exportW,
        height: exportH,
      });
      const tmpLayer = new KonvaLib.Layer();
      tmpStage.add(tmpLayer);

      // ── Render at export resolution ──
      const s = 1; // 1:1 with the model's native size
      const pad = df.basePadding;
      const phoneW = model.width;
      const phoneH = model.height;
      const radius = model.radius;
      const bezel = model.bezel;
      const screenRadius = Math.max(radius - bezel, 4);
      const phoneX = pad;
      const phoneY = (exportH - phoneH) / 2;
      const screenX = phoneX + bezel;
      const screenY = phoneY + bezel;
      const screenW = phoneW - bezel * 2;
      const screenH = phoneH - bezel * 2;
      const safeShadow = Math.min(df.shadowIntensity, 40);

      // Background
      const colors = resolveGradientColors(df.gradient);
      const isSolid = colors[0] === colors[2];
      const bg = new KonvaLib.Rect({ x: 0, y: 0, width: exportW, height: exportH, cornerRadius: 8 });
      if (isSolid) {
        bg.fill(colors[0]);
      } else {
        bg.fillLinearGradientStartPoint({ x: 0, y: 0 });
        bg.fillLinearGradientEndPoint({ x: exportW, y: exportH });
        bg.fillLinearGradientColorStops([0, colors[0], 0.5, colors[1], 1, colors[2]]);
      }
      tmpLayer.add(bg);

      // Phone body (with hole for screen)
      tmpLayer.add(
        new KonvaLib.Shape({
          sceneFunc: (ctx: any, shape: any) => {
            ctx.beginPath();
            ctx.roundRect(phoneX, phoneY, phoneW, phoneH, radius);
            ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          },
          fill: "#000",
          fillRule: "evenodd",
          shadowColor: "rgba(0,0,0,0.8)",
          shadowBlur: safeShadow > 0 ? safeShadow * 2 : 0,
          shadowOffsetY: safeShadow * 0.5,
          shadowOpacity: Math.min(safeShadow / 100, 0.7),
        })
      );

      // Ring
      tmpLayer.add(
        new KonvaLib.Rect({
          x: phoneX, y: phoneY, width: phoneW, height: phoneH,
          cornerRadius: radius, stroke: "rgba(255,255,255,0.08)", strokeWidth: 1,
        })
      );

      // Buttons
      const btnW = 3;
      tmpLayer.add(new KonvaLib.Rect({ x: phoneX + phoneW - 1, y: phoneY + phoneH * 0.25, width: btnW, height: 48, fill: "#3f3f46" }));
      tmpLayer.add(new KonvaLib.Rect({ x: phoneX - btnW + 1, y: phoneY + phoneH * 0.25, width: btnW, height: 64, fill: "#3f3f46" }));
      tmpLayer.add(new KonvaLib.Rect({ x: phoneX - btnW + 1, y: phoneY + phoneH * 0.35, width: btnW, height: 64, fill: "#3f3f46" }));

      // Screen (clipped)
      const screenGroup = new KonvaLib.Group({
        clipFunc: (ctx: any) => {
          ctx.beginPath();
          ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
          ctx.closePath();
        },
      });

      // Screenshot
      if (df.screenshot) {
        try {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = rej;
            img.src = df.screenshot!;
          });
          const coverScale = Math.max(screenW / img.width, screenH / img.height);
          const drawW = img.width * coverScale;
          const drawH = img.height * coverScale;
          screenGroup.add(new KonvaLib.Image({
            image: img,
            x: screenX + screenW / 2 + df.imgProps.x,
            y: screenY + screenH / 2 + df.imgProps.y,
            width: drawW, height: drawH,
            offsetX: drawW / 2, offsetY: drawH / 2,
            scaleX: df.imgProps.scale / 100, scaleY: df.imgProps.scale / 100,
            rotation: df.imgProps.rotate,
          }));
        } catch {}
      }

      // Notch
      if (model.notchType === "dynamic-island") {
        screenGroup.add(new KonvaLib.Rect({ x: screenX + (screenW - 120) / 2, y: screenY + 8, width: 120, height: 34, fill: "#000", cornerRadius: 17 }));
      } else if (model.notchType === "notch") {
        screenGroup.add(new KonvaLib.Rect({ x: screenX + (screenW - 160) / 2, y: screenY, width: 160, height: 30, fill: "#000", cornerRadius: [0, 0, 12, 12] }));
      } else if (model.notchType === "punch-hole") {
        screenGroup.add(new KonvaLib.Circle({ x: screenX + screenW / 2, y: screenY + 20, radius: 10, fill: "#000" }));
      } else if (model.notchType === "home-button") {
        screenGroup.add(new KonvaLib.Rect({ x: screenX, y: screenY, width: screenW, height: 60, fill: "#000" }));
        screenGroup.add(new KonvaLib.Rect({ x: screenX + (screenW - 40) / 2, y: screenY + 27, width: 40, height: 6, fill: "#18181b", cornerRadius: 3 }));
        screenGroup.add(new KonvaLib.Rect({ x: screenX, y: screenY + screenH - 60, width: screenW, height: 60, fill: "#000" }));
        screenGroup.add(new KonvaLib.Circle({ x: screenX + screenW / 2, y: screenY + screenH - 30, radius: 24, stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }));
      }

      tmpLayer.add(screenGroup);
      tmpLayer.draw();

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const dataUrl = tmpStage.toDataURL({ mimeType, pixelRatio: 2 });
      tmpStage.destroy();
      document.body.removeChild(container);

      const res = await fetch(dataUrl);
      return await res.blob();
    },
    []
  );

  const handleExport = useCallback(
    async (format: "png" | "jpeg") => {
      setIsExporting(true);
      try {
        const deviceElements = elements.filter(
          (el) => el.type === "device-frame"
        );
        if (deviceElements.length === 0) return;

        if (deviceElements.length === 1) {
          const blob = await exportSingleElement(deviceElements[0], format);
          if (!blob) throw new Error("Export failed");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `mockup-${Date.now()}.${format}`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
          const zip = new JSZip();
          await Promise.all(
            deviceElements.map(async (el, i) => {
              const blob = await exportSingleElement(el, format);
              if (blob) zip.file(`screen-${i + 1}.${format}`, blob);
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
    [elements, exportSingleElement]
  );

  const copyToClipboard = useCallback(async () => {
    setIsExporting(true);
    try {
      const deviceEl = elements.find((el) => el.type === "device-frame");
      if (!deviceEl) return;
      const blob = await exportSingleElement(deviceEl, "png");
      if (!blob) throw new Error("Blob creation failed");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    } finally {
      setIsExporting(false);
    }
  }, [elements, exportSingleElement]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ═══ Top bar ═══ */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-md px-4 py-2 flex items-center gap-3 overflow-x-auto shrink-0 z-10">
        <span className="text-xs text-zinc-500 font-mono shrink-0">
          {elements.length} element{elements.length !== 1 ? "s" : ""}
        </span>

        <div className="flex-1" />

        {/* Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => handleExport("png")}
            disabled={isExporting || !hasImages}
          >
            <Download className="w-3 h-3 mr-1" /> PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3"
            onClick={() => handleExport("jpeg")}
            disabled={isExporting || !hasImages}
          >
            <Download className="w-3 h-3 mr-1" /> JPG
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs px-3"
            onClick={copyToClipboard}
            disabled={isExporting || !hasImages}
          >
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* ═══ Main area ═══ */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* ── Canvas ── */}
        <div className="flex-1 relative bg-[#0a0a0d]">
          <MockupCanvas
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdateElement={updateElement as any}
            stageRef={stageRef}
            onZoomChange={setZoomLevel}
          />

          {/* ── Floating Toolbar ── */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl px-2 py-1.5 shadow-2xl z-20">

            {/* Add device */}
            <ToolButton
              onClick={() => addDeviceFrame()}
              disabled={!canAddMore}
              title={`Add Device (${elements.length}/${MAX_ELEMENTS})`}
              icon={<Plus className="w-4 h-4" />}
            />

            <Sep />

            {/* Zoom */}
            <ToolButton
              onClick={() => zoomBy(-1)}
              title="Zoom Out"
              icon={<ZoomOut className="w-3.5 h-3.5" />}
            />
            <button
              className="text-[11px] text-zinc-400 font-mono w-11 text-center hover:text-white transition-colors select-none"
              onClick={resetView}
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <ToolButton
              onClick={() => zoomBy(1)}
              title="Zoom In"
              icon={<ZoomIn className="w-3.5 h-3.5" />}
            />

            <Sep />

            <ToolButton
              onClick={fitToScreen}
              title="Fit to Screen"
              icon={<Maximize2 className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div
          className={`transition-all duration-200 border-l border-white/5 bg-zinc-950/80 backdrop-blur-md overflow-y-auto shrink-0 ${
            selectedDevice ? "w-72" : "w-0 border-l-0"
          }`}
        >
          {selectedDevice && (
            <div className="w-72 animate-in fade-in duration-150">
              {/* Header */}
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MonitorSmartphone className="w-4 h-4 text-primary" />
                  <span className="font-bold text-[10px] uppercase tracking-widest text-zinc-300">
                    Device Frame
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setSelectedId(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="p-3 space-y-4">
                {/* ── Model ── */}
                <Section title="Device Model">
                  <Select
                    value={selectedDevice.modelId}
                    onValueChange={(v) => changeModel(selectedDevice.id, v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Phones</SelectLabel>
                        {DEVICE_MODELS.filter((m) => m.category === "Phones").map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Tablets</SelectLabel>
                        {DEVICE_MODELS.filter((m) => m.category === "Tablets").map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Section>

                {/* ── Screenshot ── */}
                <Section title="Screenshot">
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7" asChild>
                      <label className="cursor-pointer">
                        <Upload className="w-3 h-3 mr-1" /> Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(selectedDevice.id, e)}
                        />
                      </label>
                    </Button>
                    {selectedDevice.screenshot && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs h-7 px-2"
                        onClick={() => clearImage(selectedDevice.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </Section>

                {/* ── Image transforms ── */}
                {selectedDevice.screenshot && (
                  <Section title="Image Transform">
                    <div className="space-y-3">
                      <SliderRow
                        label="Scale"
                        value={selectedDevice.imgProps.scale}
                        suffix="%"
                        min={10}
                        max={300}
                        step={1}
                        onChange={(v) => updateImgProps(selectedDevice.id, { scale: v })}
                        accent
                      />
                      <SliderRow
                        label="Horizontal"
                        value={selectedDevice.imgProps.x}
                        suffix="px"
                        min={-500}
                        max={500}
                        step={1}
                        onChange={(v) => updateImgProps(selectedDevice.id, { x: v })}
                      />
                      <SliderRow
                        label="Vertical"
                        value={selectedDevice.imgProps.y}
                        suffix="px"
                        min={-500}
                        max={500}
                        step={1}
                        onChange={(v) => updateImgProps(selectedDevice.id, { y: v })}
                      />
                      <SliderRow
                        label="Rotation"
                        value={selectedDevice.imgProps.rotate}
                        suffix="°"
                        min={-180}
                        max={180}
                        step={1}
                        onChange={(v) => updateImgProps(selectedDevice.id, { rotate: v })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-[10px] h-7 uppercase tracking-widest font-bold"
                        onClick={() =>
                          updateImgProps(selectedDevice.id, {
                            scale: 100, x: 0, y: 0, rotate: 0,
                          })
                        }
                      >
                        Reset Transform
                      </Button>
                    </div>
                  </Section>
                )}

                {/* ── Background ── */}
                <Section title="Background">
                  <div className="flex flex-wrap gap-1.5">
                    {GRADIENTS.map((g, idx) => (
                      <button
                        key={idx}
                        className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                          g === selectedDevice.gradient
                            ? "border-primary scale-110 shadow-sm"
                            : "border-zinc-700 hover:border-zinc-500"
                        } ${g}`}
                        onClick={() => setGradient(selectedDevice.id, g)}
                      />
                    ))}
                    <div
                      className={`relative w-6 h-6 rounded-full overflow-hidden border-2 shrink-0 transition-all flex items-center justify-center ${
                        !selectedDevice.gradient.startsWith("bg-")
                          ? "border-primary scale-110 shadow-sm"
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      <Pipette className="w-3 h-3 text-white absolute pointer-events-none z-10 mix-blend-difference" />
                      <input
                        type="color"
                        className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
                        value={
                          !selectedDevice.gradient.startsWith("bg-")
                            ? selectedDevice.gradient
                            : "#e2e8f0"
                        }
                        onChange={(e) =>
                          setGradient(selectedDevice.id, e.target.value)
                        }
                      />
                    </div>
                  </div>
                </Section>

                {/* ── Element settings ── */}
                <Section title="Element">
                  <div className="space-y-3">
                    <SliderRow
                      label="Shadow"
                      value={selectedDevice.shadowIntensity}
                      suffix="%"
                      min={0}
                      max={80}
                      step={2}
                      onChange={(v) =>
                        updateElement(selectedDevice.id, { shadowIntensity: v } as any)
                      }
                    />
                    <SliderRow
                      label="Padding"
                      value={selectedDevice.basePadding}
                      suffix="px"
                      min={0}
                      max={200}
                      step={4}
                      onChange={(v) => {
                        const model = getModel(selectedDevice.modelId);
                        const currentScale = computeFrameScale(
                          selectedDevice.width,
                          model,
                          selectedDevice.basePadding
                        );
                        // Recompute width/height so the device stays the same visual size
                        const newW = (model.width + v * 2) * currentScale;
                        const newH = (model.height + v * 2) * currentScale;
                        updateElement(selectedDevice.id, {
                          basePadding: v,
                          width: newW,
                          height: newH,
                        } as any);
                      }}
                    />
                  </div>
                </Section>

                {/* ── Layer + Lock ── */}
                <Section title="Layer">
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[10px] h-7"
                      onClick={() => bringToFront(selectedDevice.id)}
                    >
                      <ArrowUpToLine className="w-3 h-3 mr-1" /> Front
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[10px] h-7"
                      onClick={() => sendToBack(selectedDevice.id)}
                    >
                      <ArrowDownToLine className="w-3 h-3 mr-1" /> Back
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 shrink-0"
                      onClick={() => toggleLock(selectedDevice.id)}
                      title={selectedDevice.locked ? "Unlock" : "Lock"}
                    >
                      {selectedDevice.locked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </Section>

                {/* ── Delete ── */}
                {elements.length > 1 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full text-xs h-8 mt-2"
                    onClick={() => removeElement(selectedDevice.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove Device
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Delete confirmation ═══ */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 animate-in fade-in duration-200"
          onClick={() => setDeleteConfirmId(null)}
        >
          <Card
            className="w-full max-w-[380px] shadow-2xl border-destructive/20 animate-in zoom-in-95 duration-200 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <CardTitle className="text-lg font-bold">Remove this device?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <p className="text-center text-muted-foreground text-sm">
                This device has an uploaded screenshot. Removing it will permanently delete your work.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  onClick={confirmRemove}
                  className="w-full font-bold h-10"
                >
                  Yes, remove
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers (keep the JSX above clean)
// ─────────────────────────────────────────────────────────────────────────────

function ToolButton({
  icon,
  active,
  onClick,
  title,
  disabled,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
        active
          ? "bg-primary/20 text-primary"
          : "text-zinc-400 hover:text-white hover:bg-white/5"
      } ${disabled ? "opacity-30 pointer-events-none" : ""}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-white/10 mx-0.5" />;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
        {title}
      </Label>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-500 font-medium">{label}</span>
        <span
          className={`font-mono px-1 rounded ${
            accent
              ? "bg-primary/10 text-primary"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]: number[]) => onChange(v)}
        className="py-0.5"
      />
    </div>
  );
}
