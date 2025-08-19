'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Globe,
  Briefcase,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Database,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Contents',
    href: '/contents',
    icon: FileText,
  },
  {
    title: 'Crawlers',
    href: '/crawlers',
    icon: Globe,
  },
  {
    title: 'Jobs',
    href: '/jobs',
    icon: Briefcase,
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    title: 'Database',
    href: '/database',
    icon: Database,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="glass border-r border-white/10 h-screen sticky top-0 flex flex-col"
      style={{ width: collapsed ? 80 : 280 }}
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center space-x-3"
            style={{ opacity: collapsed ? 0 : 1 }}
          >
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-lg font-semibold">Lighthouse</h2>
                <p className="text-xs text-muted-foreground">Admin Dashboard</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all',
                'hover:bg-white/10',
                isActive &&
                  'bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-600/30'
              )}
            >
              <item.icon
                className={cn('w-5 h-5', isActive && 'text-violet-400')}
              />
              {!collapsed && (
                <span
                  className={cn('font-medium', isActive && 'text-violet-400')}
                >
                  {item.title}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div
          className={cn(
            'flex items-center space-x-3 px-3 py-2',
            collapsed && 'justify-center'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-blue-600" />
          {!collapsed && (
            <div className="flex-1">
              <p className="text-sm font-medium">Admin User</p>
              <p className="text-xs text-muted-foreground">
                admin@lighthouse.io
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
