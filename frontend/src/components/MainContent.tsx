'use client';

import { useSidebar } from '@/contexts/SidebarContext';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  
  return (
    <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-60'}`}>
      {children}
    </main>
  );
}



