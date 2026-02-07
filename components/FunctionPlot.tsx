import React, { useEffect, useRef } from 'react';
import functionPlot from 'function-plot';

interface FunctionPlotProps {
  options: any;
}

const FunctionPlot: React.FC<FunctionPlotProps> = ({ options }) => {
  const rootEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootEl.current) {
      try {
        // Clear previous plot
        rootEl.current.innerHTML = '';
        
        functionPlot({
          target: rootEl.current,
          grid: true,
          tip: {
            xLine: true,
            yLine: true,
            renderer: (x: number, y: number) => {
               return `(${x.toFixed(3)}, ${y.toFixed(3)})`;
            }
          },
          ...options,
          // Force sizing to fit container if not explicitly set
          width: options.width || 550,
          height: options.height || 350,
        });
      } catch (e) {
        console.error("Function Plot Error", e);
        if (rootEl.current) {
            rootEl.current.innerHTML = `<div class="text-red-400 text-xs font-mono p-2">Error plotting function</div>`;
        }
      }
    }
  }, [options]);

  return (
    <div className="flex justify-center my-6">
        <div 
            ref={rootEl} 
            className="overflow-hidden rounded-xl bg-white p-2 shadow-lg"
        />
    </div>
  );
};

export default FunctionPlot;