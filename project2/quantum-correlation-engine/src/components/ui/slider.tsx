import { useEffect, useState } from "react";

type Props = {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (v: number[]) => void;
  className?: string; //allow className from callers
};

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className = "",
}: Props) {
  const [val, setVal] = useState(value[0]);
  useEffect(() => setVal(value[0]), [value]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={val}
      onChange={(e) => {
        const v = Number(e.target.value);
        setVal(v);
        onValueChange?.([v]);
      }}
      //merge caller’s classes; keep sensible defaults
      className={`w-full accent-slate-900 ${className}`}
    />
  );
}
