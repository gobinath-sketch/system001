import React, { useEffect, useRef, useState } from 'react';

const SafeResponsiveContainer = ({ minHeight = 220, children, className = '' }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateSizeState = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(minHeight, Math.floor(rect.height));
      setSize({ width, height });
      setReady(width > 0 && height > 0);
    };

    updateSizeState();

    const observer = new ResizeObserver(updateSizeState);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`w-full h-full min-w-0 ${className}`} style={{ minHeight }}>
      {ready && React.isValidElement(children)
        ? React.cloneElement(children, { width: size.width, height: size.height })
        : null}
    </div>
  );
};

export default SafeResponsiveContainer;
