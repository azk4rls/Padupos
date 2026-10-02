'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { MobileDrawer } from './MobileDrawer';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main App Container */}
      <div className="flex flex-1 flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header */}
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation & Drawer */}
      <MobileNav onOpenMenu={() => setMobileMenuOpen(true)} />
      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </div>
  );
}
