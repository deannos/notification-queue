import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useHealthCheck, type HealthStatus } from '@/hooks/useHealthCheck';
import { api } from '@/api';
import type { Notification } from '@/types';
import { NotificationPanel } from './NotificationPanel';
import { AppPanel } from './AppPanel';
import { UserPanel } from './UserPanel';
import { CommandPalette } from './CommandPalette';
import { MagneticButton } from './MagneticButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SunIcon, MoonIcon, SearchIcon } from 'lucide-react';

type Panel = 'notifications' | 'apps' | 'users';

const panelVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.23, 1, 0.32, 1] as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.16 } },
};

const healthMeta: Record<HealthStatus, { label: string; dot: string }> = {
  ok:       { label: 'Server healthy',            dot: 'bg-emerald-500' },
  degraded: { label: 'Degraded — DB unavailable', dot: 'bg-red-500'     },
  unknown:  { label: 'Checking…',                 dot: 'bg-zinc-500'    },
};

export function Dashboard() {
  const { user, token, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [panel, setPanel] = useState<Panel>('notifications');
  const [liveNotif, setLiveNotif] = useState<Notification | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleIncoming = useCallback((n: Notification) => setLiveNotif(n), []);
  const wsStatus = useWebSocket(token, handleIncoming);
  const health   = useHealthCheck();

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => api.get<{ notifications: []; total: number }>('/api/v1/notification?read=false&limit=1'),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.total ?? 0;

  const navItems: Panel[] = [
    'notifications',
    'apps',
    ...(user?.is_admin ? ['users' as Panel] : []),
  ];

  const navLabel = (id: Panel) => {
    if (id === 'notifications') return (
      <span className="flex items-center gap-1.5">
        Notifications
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </span>
    );
    return <>{id === 'apps' ? 'Applications' : 'Users'}</>;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground antialiased">

        {/* ── Topbar ── */}
        <header className="flex items-center gap-2 sm:gap-6 px-3 sm:px-6 h-[52px] bg-card/60 border-b border-border backdrop-blur-md sticky top-0 z-50 shrink-0">

          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.span
              className="text-lg"
              animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 5 }}
            >🔔</motion.span>
            <span className="text-sm font-semibold text-primary tracking-tight">NotifyQ</span>
          </div>

          {/* Tab navigation */}
          <nav className="flex items-center gap-0.5 overflow-x-auto">
            {navItems.map(id => (
              <motion.button
                key={id}
                onClick={() => setPanel(id)}
                className={`relative px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors duration-150 whitespace-nowrap ${
                  panel === id
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                whileTap={{ scale: 0.97 }}
              >
                {panel === id && (
                  <motion.span
                    layoutId="tab-bg"
                    className="absolute inset-0 rounded-md bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{navLabel(id)}</span>
              </motion.button>
            ))}
          </nav>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Open command palette"
            >
              <SearchIcon className="w-3 h-3" />
              <span>Search</span>
              <kbd className="ml-1 text-[10px] bg-background px-1 rounded">⌘K</kbd>
            </button>

            {/* Health */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  className="flex items-center gap-1.5 cursor-default"
                  animate={health === 'degraded' ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${healthMeta[health].dot} ${health === 'ok' ? 'shadow-[0_0_6px_theme(colors.emerald.500)]' : ''}`} />
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {health === 'ok' ? 'Healthy' : health === 'degraded' ? 'Degraded' : '…'}
                  </span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom">{healthMeta[health].label}</TooltipContent>
            </Tooltip>

            {/* WS */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.span
                  className={`w-1.5 h-1.5 rounded-full cursor-default ${
                    wsStatus === 'connected'
                      ? 'bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]'
                      : 'bg-zinc-600'
                  }`}
                  animate={wsStatus === 'connected' ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">WebSocket {wsStatus}</TooltipContent>
            </Tooltip>

            {/* User */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground">
              <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </span>
              <span className="hidden sm:inline">{user?.username}</span>
            </div>

            <motion.button
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              whileTap={{ scale: 0.9 }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon className="w-3.5 h-3.5" /> : <MoonIcon className="w-3.5 h-3.5" />}
            </motion.button>

            <MagneticButton variant="ghost" size="sm" onClick={logout}
              className="text-muted-foreground hover:text-foreground text-xs px-2.5"
            >
              Logout
            </MagneticButton>
          </div>
        </header>

        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          isAdmin={!!user?.is_admin}
          theme={theme}
          onNavigate={p => setPanel(p)}
          onToggleTheme={toggleTheme}
          onLogout={logout}
        />

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
            <AnimatePresence mode="wait">
              {panel === 'notifications' && (
                <motion.div key="notifications" {...panelVariants}>
                  <NotificationPanel liveNotif={liveNotif} onLiveConsumed={() => setLiveNotif(null)} />
                </motion.div>
              )}
              {panel === 'apps' && (
                <motion.div key="apps" {...panelVariants}>
                  <AppPanel />
                </motion.div>
              )}
              {panel === 'users' && (
                <motion.div key="users" {...panelVariants}>
                  <UserPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

      </div>
    </TooltipProvider>
  );
}
