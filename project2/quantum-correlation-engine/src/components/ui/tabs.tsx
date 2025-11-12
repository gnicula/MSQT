import * as React from 'react';

type TabsCtx = { value: string; setValue: (v: string) => void };
const Ctx = React.createContext<TabsCtx | null>(null);

export function Tabs({ defaultValue, className = '', children }: { defaultValue: string; className?: string; children: React.ReactNode; }) {
  const [value, setValue] = React.useState(defaultValue);
  return <div className={className}><Ctx.Provider value={{ value, setValue }}>{children}</Ctx.Provider></div>;
}

export function TabsList({ className = '', children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`inline-flex rounded-xl border bg-white ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={`px-3 py-1.5 text-sm rounded-xl ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = '', children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
