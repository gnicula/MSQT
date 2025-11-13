import type * as React from 'react';

// Define the props for the Button component, extending the built-in HTML button attributes.
// An optional 'variant' prop controls the button's visual style.
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
};

// Map each variant to its corresponding set of Tailwind CSS classes.
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  outline: 'border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-50',
};

// Reusable Button component with consistent styling and variant support.
export function Button({ className = '', variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      // Combine base styles with the selected variant and any custom classes passed in.
      className={`px-3 py-2 rounded-2xl text-sm transition ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
