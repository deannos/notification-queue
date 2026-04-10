import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useHealthCheck, type HealthStatus } from '@/hooks/useHealthCheck';
import type { Notification } from '@/types';
import { NotificationPanel } from './NotificationPanel';
import { AppPanel } from './AppPanel';
import { UserPanel } from './UserPanel';
import { MagneticButton } from './MagneticButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Panel = 'notifications' | 'apps' | 'users';

const panelVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

const healthMeta: Record<HealthStatus, { label: string; color: string }> = {
  ok:      { label: 'Server healthy',              color: 'hsl(145 63% 49%)' },
  degraded:{ label: 'Degraded — DB unavailable',   color: 'hsl(355 80% 60%)' },
  unknown: { label: 'Checking server…',            color: 'hsl(240 6% 60%)'  },
};

export function Dashboard() {
  const { user, token, logout } = useAuth();
  const [panel, setPanel] = useState<Panel>('notifications');
  const [liveNotif, setLiveNotif] = useState<Notification | null>(null);

  const handleIncoming = useCallback((n: Notification) => setLiveNotif(n), []);
  const wsStatus = useWebSocket(token, handleIncoming);
  const health = useHealthCheck();

  const navItems: { id: Panel; label: string }[] = [
    { id: 'notifications', label: '🔔 Notifications' },
    { id: 'apps', label: '🔑 Applications' },
    ...(user?.is_admin ? [{ id: 'users' as Panel, label: '👤 Users' }] : []),
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 h-14 bg-card border-b border-border sticky top-0 z-50 shrink-0">
          <div className="flex items-center gap-2.5 font-bold text-primary">
            <motion.span
              animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
            >🔔</motion.span>
            <span>NotifyQ</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Health indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.span
                  className="text-xs font-semibold cursor-default select-none"
                  style={{ color: healthMeta[health].color }}
                  animate={health === 'degraded' ? { opacity: [1, 0.35, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  ● {health === 'ok' ? 'Healthy' : health === 'degraded' ? 'Degraded' : '…'}
                </motion.span>
              </TooltipTrigger>
              <TooltipContent>{healthMeta[health].label}</TooltipContent>
            </Tooltip>

            {/* WS indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400' : 'bg-muted-foreground'}`}
                  animate={wsStatus === 'connected' ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </TooltipTrigger>
              <TooltipContent>WebSocket {wsStatus}</TooltipContent>
            </Tooltip>

            <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full border border-border">
              👤 {user?.username}
            </span>
            <MagneticButton variant="outline" size="sm" onClick={logout}>Logout</MagneticButton>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[220px] bg-card border-r border-border flex flex-col py-4 shrink-0">
            <nav className="flex flex-col gap-0.5 px-2">
              {navItems.map(item => (
                <motion.button
                  key={item.id}
                  onClick={() => setPanel(item.id)}
                  className={`text-left px-3 py-2.5 rounded-md text-sm transition-colors border-l-2 ${
                    panel === item.id
                      ? 'text-primary border-primary bg-primary/10'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary'
                  }`}
                  whileHover={{ x: 3 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  {item.label}
                </motion.button>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-y-auto p-6">
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
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
