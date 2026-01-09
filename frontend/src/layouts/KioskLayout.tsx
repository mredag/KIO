import { ReactNode } from 'react';

interface KioskLayoutProps {
  children: ReactNode;
}

export default function KioskLayout({ children }: KioskLayoutProps) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Main content */}
      <div className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
