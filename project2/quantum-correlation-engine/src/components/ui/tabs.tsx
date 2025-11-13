import { createContext, useContext, useState } from 'react';
import type { ReactNode, HTMLAttributes } from 'react';

type TabsCtx = { value: string; setValue: (v: string) => void };
const Ctx = createContext<TabsCtx | null>(null);

// Root Tabs component providing shared context for active tab state
export function Tabs({
  defaultValue,
  className = '',
  children,
}: {
  defaultValue: string;
  className?: string;
  children: ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className={className}>
      <Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider>
    </div>
  );
}

// Wrapper for tab triggers; typically rendered as a horizontal button group
export function TabsList({
  className = '',
  children,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`inline-flex rounded-xl border bg-white ${className}`}>
      {children}
    </div>
  );
}

// Individual tab trigger button; updates active tab in context
export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const ctx = useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={`px-3 py-1.5 text-sm rounded-xl ${
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

// Renders content only when its associated tab is active
export function TabsContent({
  value,
  className = '',
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
