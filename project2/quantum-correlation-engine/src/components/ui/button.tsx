import type * as React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
};

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  outline: 'border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-50',
};

export function Button({ className = '', variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={`px-3 py-2 rounded-2xl text-sm transition ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
