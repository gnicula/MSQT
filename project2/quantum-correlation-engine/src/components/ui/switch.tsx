import * as React from 'react';

type Props = {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (val: boolean) => void;
};

export function Switch({ checked = false, onCheckedChange, id }: Props) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={`w-11 h-6 rounded-full transition relative
        ${checked ? 'bg-slate-900' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition
          ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}
