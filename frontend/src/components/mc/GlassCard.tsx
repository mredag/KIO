import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className = '', hover = true }: GlassCardProps) {
  return (
    <div
      className={`mc-glass rounded-lg p-4 ${hover ? 'mc-glass--hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
