import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'sans-serif'
});

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    const renderChart = async () => {
      if (!chart) return;
      
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (error) {
        console.error('Failed to render mermaid chart:', error);
        // Fallback or error message could go here, but often keeping the code block is better logic 
        // if it fails. For now, we show error.
        setSvg('<div class="text-red-400 text-xs font-mono p-2 border border-red-900 bg-red-900/20 rounded">Failed to render diagram</div>');
      }
    };

    renderChart();
  }, [chart]);

  return (
    <div 
      ref={containerRef}
      className="my-6 flex justify-center bg-slate-900/50 p-6 rounded-xl border border-slate-800 shadow-inner overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default Mermaid;