import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import BackendInfo from '@/components/BackendInfo'
import MainContent from '@/components/MainContent'
import { SidebarProvider } from '@/contexts/SidebarContext'

export const metadata: Metadata = {
  title: 'Frieren - Управление студентами и лекциями',
  description: 'Система управления студентами, лекциями и домашними заданиями',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors">
        <SidebarProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <MainContent>{children}</MainContent>
          </div>
        </SidebarProvider>
        <BackendInfo />
      </body>
    </html>
  )
}
