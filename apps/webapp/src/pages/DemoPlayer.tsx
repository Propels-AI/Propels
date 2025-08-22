import { useState } from "react";
import { ProtectPage } from "@/lib/auth/AuthComponents";

export function DemoPlayer() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const hotspots = [
    {
      id: "1",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      targetStep: 2,
      tooltip: "Click to go to step 2",
    },
    {
      id: "2",
      x: 200,
      y: 200,
      width: 50,
      height: 50,
      targetStep: 3,
      tooltip: "Click to go to step 3",
    },
  ];

  const handleHotspotClick = (targetStep: number) => {
    setCurrentStep(targetStep);
  };

  return (
    <ProtectPage>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full max-w-4xl h-96 flex items-center justify-center relative">
            <span className="text-gray-500">Demo player content</span>

            {hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 cursor-pointer hover:bg-opacity-30 transition-all"
                style={{
                  left: `${hotspot.x}px`,
                  top: `${hotspot.y}px`,
                  width: `${hotspot.width}px`,
                  height: `${hotspot.height}px`,
                }}
                onClick={() => handleHotspotClick(hotspot.targetStep)}
                title={hotspot.tooltip}
              />
            ))}
          </div>
        </div>
        <div className="bg-gray-100 p-4 border-t">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-gray-600">
              Step {currentStep} of {totalSteps}
            </p>
          </div>
        </div>
      </div>
    </ProtectPage>
  );
}

export default DemoPlayer;
