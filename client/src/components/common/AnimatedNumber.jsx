import { useEffect, useRef, useState } from 'react';

const toSafeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const AnimatedNumber = ({
  value = 0,
  duration = 900,
  className = '',
  formatValue
}) => {
  const targetValue = toSafeNumber(value);
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    if (duration <= 0) {
      setDisplayValue(targetValue);
      return undefined;
    }

    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(targetValue * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetValue, duration]);

  const renderedValue = formatValue ? formatValue(displayValue) : Math.round(displayValue).toLocaleString('en-IN');
  return <span className={className}>{renderedValue}</span>;
};

export default AnimatedNumber;
