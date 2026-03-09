import { useRef, useEffect, useState, type RefObject } from "react";

interface TemplatePreviewProps {
  html: string;
  width: number;
  height: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLoad: () => void;
}

export function TemplatePreview({ html, width, height, iframeRef, onLoad }: TemplatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: cw, height: ch } = entry.contentRect;
      const sx = cw / width;
      const sy = ch / height;
      setScale(Math.min(sx, sy, 1));
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [width, height]);

  return (
    <div ref={containerRef} className="flex-1 flex items-start justify-center h-full relative">
      <div
        style={{
          width: width * scale,
          height: height * scale,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={onLoad}
          style={{
            width,
            height,
            border: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
