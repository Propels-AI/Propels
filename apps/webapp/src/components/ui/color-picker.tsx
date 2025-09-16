import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

type ColorFormat = "hex" | "rgb" | "hsl";

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [globalColor, setGlobalColor] = useState(value || "#059669");
  const [huePosition, setHuePosition] = useState(0);
  const [saturationPosition, setSaturationPosition] = useState({ x: 50, y: 50 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("hex");
  const [inputValue, setInputValue] = useState("");
  const dragRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Color conversion utilities
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const hex = Math.round(c).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const add = max + min;
    const l = add * 0.5;

    let s = 0;
    let h = 0;

    if (diff !== 0) {
      s = l < 0.5 ? diff / add : diff / (2 - add);
      switch (max) {
        case r:
          h = (g - b) / diff + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / diff + 2;
          break;
        case b:
          h = (r - g) / diff + 4;
          break;
      }
      h /= 6;
    }

    return [h * 360, s * 100, l * 100];
  };

  const hslToHex = (h: number, s: number, l: number) => {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Format color based on selected format
  const formatColor = (hex: string, format: ColorFormat) => {
    switch (format) {
      case "hex":
        return hex.toUpperCase();
      case "rgb": {
        const { r, g, b } = hexToRgb(hex);
        return `rgb(${r}, ${g}, ${b})`;
      }
      case "hsl": {
        const [h, s, l] = hexToHsl(hex);
        return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
      }
      default:
        return hex;
    }
  };

  // Parse different color formats to hex
  const parseColorToHex = (input: string): string | null => {
    const trimmed = input.trim().toLowerCase();

    // Hex format
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    // RGB format
    const rgbMatch = trimmed.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      if (r <= 255 && g <= 255 && b <= 255) {
        return rgbToHex(r, g, b);
      }
    }

    // HSL format
    const hslMatch = trimmed.match(/^hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch.map(Number);
      if (h <= 360 && s <= 100 && l <= 100) {
        return hslToHex(h, s, l);
      }
    }

    return null;
  };

  // Initialize positions based on current color
  useEffect(() => {
    const [h, s, l] = hexToHsl(globalColor);
    setHuePosition((h / 360) * 100);
    setSaturationPosition({ x: s, y: 100 - l });
    setInputValue(formatColor(globalColor, colorFormat));
  }, [globalColor, colorFormat]);

  // Update global color when value prop changes
  useEffect(() => {
    if (value && value !== globalColor) {
      setGlobalColor(value);
    }
  }, [value]);

  // Color picker utility functions
  const handleColorPickerUpdate = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    const rect = dragRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const saturation = (x / rect.width) * 100;
    const lightness = 100 - (y / rect.height) * 100;

    setSaturationPosition({ x: saturation, y: 100 - lightness });

    // Get current hue
    const [currentHue] = hexToHsl(globalColor);
    const hex = hslToHex(currentHue, saturation, lightness);
    setGlobalColor(hex);
    onChange(hex);
  };

  const updateHueFromBar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hueRef.current) return;

    const rect = hueRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));
    const hue = (clampedX / rect.width) * 360;

    setHuePosition((clampedX / rect.width) * 100);

    // Get current saturation and lightness
    const [, s, l] = hexToHsl(globalColor);
    const hex = hslToHex(hue, s, l);
    setGlobalColor(hex);
    onChange(hex);
  };

  const handleInputChange = (inputValue: string) => {
    setInputValue(inputValue);
    const hex = parseColorToHex(inputValue);
    if (hex) {
      setGlobalColor(hex);
      onChange(hex);
    }
  };

  const handleInputBlur = () => {
    const hex = parseColorToHex(inputValue);
    if (!hex) {
      // Revert to current color if invalid
      setInputValue(formatColor(globalColor, colorFormat));
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`w-full justify-start h-8 bg-transparent !text-xs ${className}`}>
          <div className="w-4 h-4 rounded border mr-2" style={{ backgroundColor: globalColor }} />
          <span className="text-xs">{formatColor(globalColor, colorFormat)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 font-sans">
        <div className="space-y-4">
          {/* Hue Gradient Bar */}
          <div>
            <Label className="text-xs text-muted-foreground">Hue</Label>
            <div
              ref={hueRef}
              className="relative mt-2 h-4 rounded-md overflow-hidden cursor-pointer"
              style={{
                background:
                  "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 100%)",
              }}
              onMouseDown={(e) => {
                updateHueFromBar(e);
                // Add global mouse event listeners for dragging
                const handleGlobalMouseMove = (globalE: MouseEvent) => {
                  if (hueRef.current) {
                    const rect = hueRef.current.getBoundingClientRect();
                    const x = globalE.clientX - rect.left;
                    const clampedX = Math.max(0, Math.min(rect.width, x));
                    const hue = (clampedX / rect.width) * 360;
                    setHuePosition((clampedX / rect.width) * 100);
                    const [, s, l] = hexToHsl(globalColor);
                    const hex = hslToHex(hue, s, l);
                    setGlobalColor(hex);
                    onChange(hex);
                  }
                };
                const handleGlobalMouseUp = () => {
                  document.removeEventListener("mousemove", handleGlobalMouseMove);
                  document.removeEventListener("mouseup", handleGlobalMouseUp);
                };
                document.addEventListener("mousemove", handleGlobalMouseMove);
                document.addEventListener("mouseup", handleGlobalMouseUp);
              }}
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-6 bg-white border border-gray-300 rounded-sm shadow-sm pointer-events-none"
                style={{
                  left: `${huePosition}%`,
                  transform: "translateX(-50%) translateY(-50%)",
                }}
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <Label className="text-xs text-muted-foreground">Color Picker</Label>
            <div
              ref={dragRef}
              className="relative mt-2 h-32 rounded-md overflow-hidden cursor-crosshair"
              style={{
                background: `
                  linear-gradient(to bottom, 
                    rgba(255, 255, 255, 1) 0%, 
                    rgba(255, 255, 255, 0) 50%, 
                    rgba(0, 0, 0, 1) 100%),
                  linear-gradient(to right, 
                    #808080 0%, 
                    ${globalColor} 100%)
                `,
              }}
              onMouseDown={(e) => {
                handleColorPickerUpdate(e);
                // Add global mouse event listeners for dragging
                const handleGlobalMouseMove = (globalE: MouseEvent) => {
                  if (dragRef.current) {
                    const rect = dragRef.current.getBoundingClientRect();
                    const x = Math.max(0, Math.min(rect.width, globalE.clientX - rect.left));
                    const y = Math.max(0, Math.min(rect.height, globalE.clientY - rect.top));
                    const saturation = (x / rect.width) * 100;
                    const lightness = 100 - (y / rect.height) * 100;
                    setSaturationPosition({ x: saturation, y: 100 - lightness });
                    const [currentHue] = hexToHsl(globalColor);
                    const hex = hslToHex(currentHue, saturation, lightness);
                    setGlobalColor(hex);
                    onChange(hex);
                  }
                };
                const handleGlobalMouseUp = () => {
                  document.removeEventListener("mousemove", handleGlobalMouseMove);
                  document.removeEventListener("mouseup", handleGlobalMouseUp);
                };
                document.addEventListener("mousemove", handleGlobalMouseMove);
                document.addEventListener("mouseup", handleGlobalMouseUp);
              }}
            >
              <div
                className="absolute w-3 h-3 border-2 border-white rounded-full shadow-sm pointer-events-none"
                style={{
                  left: `${saturationPosition.x}%`,
                  top: `${saturationPosition.y}%`,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>

          {/* Color Format Selection */}
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <Select value={colorFormat} onValueChange={(value: ColorFormat) => setColorFormat(value)}>
              <SelectTrigger className="w-full mt-2 h-8 !text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-sans">
                <SelectItem value="hex">HEX</SelectItem>
                <SelectItem value="rgb">RGB</SelectItem>
                <SelectItem value="hsl">HSL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color Input */}
          <div>
            <Label className="text-xs text-muted-foreground">Color Value</Label>
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              className="w-full h-8 mt-1 font-mono text-xs"
              placeholder={formatColor("#000000", colorFormat)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
