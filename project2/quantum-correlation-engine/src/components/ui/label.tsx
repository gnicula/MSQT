import type * as React from 'react';

// Reusable label component with consistent text styling
export function Label({ className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-slate-700 ${className}`} {...props} />;
}
