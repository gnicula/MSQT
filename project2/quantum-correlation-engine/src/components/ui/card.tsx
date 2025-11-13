import type * as React from 'react';

// Basic card container with rounded corners and border
export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border bg-white ${className}`} {...props} />;
}

// Header section for titles or action elements
export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="p-4" {...props} />;
}

// Title text styled for hierarchy within the card
export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className="text-base font-semibold" {...props} />;
}

// Content area for the main body of the card
export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div className="p-4 pt-0" {...props} />;
}
