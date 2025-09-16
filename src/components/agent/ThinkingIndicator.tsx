import React, { useEffect, useState } from "react";
// Removed unused import: CommonProps

// Component doesn't need any props currently
type ThinkingIndicatorProps = Record<string, never>;

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = () => {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="self-start mx-3 my-3 flex">
      <span className="text-text-secondary text-xl font-bold leading-none">
        {dots}
      </span>
    </div>
  );
};

export default ThinkingIndicator;
