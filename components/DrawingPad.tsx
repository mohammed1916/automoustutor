import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Pencil, X, Check } from 'lucide-react';

interface DrawingPadProps {
  onConfirm: (imageBase64: string) => void;
  onCancel: () => void;
}

const DrawingPad: React.FC<DrawingPadProps> = ({ onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff'); // Default white
  
  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set resolution
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 300; // Fixed height
      }
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // match slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
      }
    }
  }, []); // Run once on mount

  // Update color when state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = color;
    }
  }, [color]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onConfirm(dataUrl);
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-fade-in mb-4">
      <div className="flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">Sketch Pad</span>
            <div className="h-4 w-px bg-slate-700 mx-1"></div>
            <button 
                onClick={() => setColor('#ffffff')} 
                className={`p-1.5 rounded hover:bg-slate-700 ${color === '#ffffff' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                title="Pen"
            >
                <Pencil size={14} />
            </button>
            <button 
                onClick={() => setColor('#0f172a')} 
                className={`p-1.5 rounded hover:bg-slate-700 ${color === '#0f172a' ? 'bg-slate-700 text-cyan-400' : 'text-slate-400'}`}
                title="Eraser (draws background color)"
            >
                <Eraser size={14} />
            </button>
        </div>
        <div className="flex items-center gap-2">
             <button onClick={clearCanvas} className="text-xs text-slate-400 hover:text-white px-2">Clear</button>
             <button onClick={onCancel} className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded">
                <X size={16} />
             </button>
        </div>
      </div>
      
      <div className="w-full h-[300px] cursor-crosshair touch-none relative">
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="block w-full h-full"
        />
      </div>
      
      <div className="p-2 bg-slate-800 border-t border-slate-700 flex justify-end">
        <button 
            onClick={handleConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors"
        >
            <Check size={16} />
            Attach Drawing
        </button>
      </div>
    </div>
  );
};

export default DrawingPad;
