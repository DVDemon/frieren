'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Загружаем состояние из localStorage только на клиенте
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('sidebarCollapsed');
      if (savedState !== null) {
        setIsCollapsed(savedState === 'true');
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', String(newState));
      }
      return newState;
    });
  };

  // Всегда предоставляем контекст, даже до монтирования
  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  // Во время SSR контекст может быть недоступен, возвращаем значения по умолчанию
  if (context === undefined) {
    return {
      isCollapsed: false,
      toggleSidebar: () => {},
    };
  }
  return context;
}

