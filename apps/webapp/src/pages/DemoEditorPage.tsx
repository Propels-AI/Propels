import React, { useState, useRef } from "react";
import { ProtectPage } from "@/lib/auth/AuthComponents";
import { Input } from "@/components/ui/input";

export function DemoEditorPage() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [hotspots, setHotspots] = useState<
    Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      tooltip?: string;
    }>
  >([]);
  const [editingTooltip, setEditingTooltip] = useState<string | null>(null);
  const [tooltipText, setTooltipText] = useState("");
  const imageRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log(`Drawing from (${startPos.x}, ${startPos.y}) to (${x}, ${y})`);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newHotspot = {
      id: Math.random()
        .toString(36)
        .substring(7),
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      width: Math.abs(x - startPos.x),
      height: Math.abs(y - startPos.y),
    };

    setHotspots([...hotspots, newHotspot]);
    setIsDrawing(false);

    setEditingTooltip(newHotspot.id);
    setTooltipText("");
  };

  const handleTooltipChange = (id: string, text: string) => {
    setHotspots(
      hotspots.map((hotspot) =>
        hotspot.id === id ? { ...hotspot, tooltip: text } : hotspot
      )
    );
  };

  const handleTooltipSubmit = (id: string) => {
    handleTooltipChange(id, tooltipText);
    setEditingTooltip(null);
    setTooltipText("");
  };

  return (
    <ProtectPage>
      <div className="min-h-screen flex">
        <div className="flex-1 p-8">
          <h1 className="text-2xl font-bold mb-4">Demo Editor</h1>
          <div
            ref={imageRef}
            className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-96 flex items-center justify-center relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <span className="text-gray-500">Placeholder for main image</span>

            {hotspots.map((hotspot) => (
              <div key={hotspot.id}>
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
                  style={{
                    left: `${hotspot.x}px`,
                    top: `${hotspot.y}px`,
                    width: `${hotspot.width}px`,
                    height: `${hotspot.height}px`,
                  }}
                />

                {editingTooltip === hotspot.id && (
                  <div
                    className="absolute bg-white border rounded p-2 shadow-lg"
                    style={{
                      left: `${hotspot.x + hotspot.width + 5}px`,
                      top: `${hotspot.y}px`,
                    }}
                  >
                    <Input
                      type="text"
                      placeholder="Add tooltip text"
                      value={tooltipText}
                      onChange={(e) => setTooltipText(e.target.value)}
                      className="mb-2"
                      autoFocus
                    />
                    <button
                      onClick={() => handleTooltipSubmit(hotspot.id)}
                      className="bg-blue-500 hover:bg-blue-700 text-white text-sm py-1 px-2 rounded"
                    >
                      Save
                    </button>
                  </div>
                )}

                {editingTooltip !== hotspot.id && hotspot.tooltip && (
                  <div
                    className="absolute bg-blue-500 text-white text-sm rounded py-1 px-2"
                    style={{
                      left: `${hotspot.x + hotspot.width + 5}px`,
                      top: `${hotspot.y}px`,
                    }}
                  >
                    {hotspot.tooltip}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="w-80 bg-gray-100 p-4 border-l">
          <h2 className="text-xl font-semibold mb-4">Steps</h2>
          <div className="space-y-2">
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm font-medium">Step 1</p>
              <p className="text-xs text-gray-500">Screenshot description</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm font-medium">Step 2</p>
              <p className="text-xs text-gray-500">Screenshot description</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-sm font-medium">Step 3</p>
              <p className="text-xs text-gray-500">Screenshot description</p>
            </div>
          </div>
        </div>
      </div>
    </ProtectPage>
  );
}

export default DemoEditorPage;
