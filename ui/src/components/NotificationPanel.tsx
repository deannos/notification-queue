import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/api';
import type { App, Notification } from '@/types';
import { MagneticButton } from './MagneticButton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { CheckIcon, Trash2Icon, SearchIcon, XIcon } from 'lucide-react';

const LIMIT = 20;

const listItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: [0.23, 1, 0.32, 1] as const, duration: 0.35 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

interface Props {
  liveNotif: Notification | null;
  onLiveConsumed: () => void;
}

export function NotificationPanel({ liveNotif, onLiveConsumed }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [apps, setApps] = useState<App[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [filterRead, setFilterRead] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => {
    api.get<App[]>('/api/v1/application').then(data => setApps(data ?? [])).catch(() => {});
  }, []);

  const buildQuery = useCallback((off: number) => {
    const p = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
    if (search)         p.set('q', search);
    if (filterApp)      p.set('app_id', filterApp);
    if (filterRead)     p.set('read', filterRead);
    if (filterPriority) p.set('priority', filterPriority);
    return `/api/v1/notification?${p.toString()}`;
  }, [search, filterApp, filterRead, filterPriority]);

  const load = useCallback(async (off: number) => {
    try {
      const data = await api.get<{ notifications: Notification[]; total: number }>(buildQuery(off));
      setNotifs(data.notifications ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
  }, [buildQuery]);

  useEffect(() => {
    setOffset(0);
    void load(0);
  }, [search, filterApp, filterRead, filterPriority, load]);

  useEffect(() => { void load(offset); }, [offset, load]);

  useEffect(() => {
    if (!liveNotif) return;
    setNotifs(prev => [liveNotif, ...prev]);
    setTotal(t => t + 1);
    onLiveConsumed();
  }, [liveNotif, onLiveConsumed]);

  const markRead = async (id: string) => {
    await api.put(`/api/v1/notification/${id}/read`);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotif = async (id: string) => {
    await api.del(`/api/v1/notification/${id}`);
    setNotifs(prev => prev.filter(n => n.id !== id));
    setTotal(t => Math.max(0, t - 1));
  };

  const markAllRead = async () => {
    await Promise.all(notifs.filter(n => !n.read).map(n => api.put(`/api/v1/notification/${n.id}/read`)));
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteAll = async () => {
    if (!confirm('Delete all notifications?')) return;
    await api.del('/api/v1/notification');
    setNotifs([]);
    setTotal(0);
    setOffset(0);
  };

  const clearFilters = () => {
    setSearch(''); setFilterApp(''); setFilterRead(''); setFilterPriority('');
  };
  const hasFilters = search || filterApp || filterRead || filterPriority;

  const pages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const unreadCount = notifs.filter(n => !n.read).length;

  const priorityBadge = (p: number) => {
    if (p >= 8) return <Badge variant="destructive">{p}</Badge>;
    if (p >= 4) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">{p}</Badge>;
    return <Badge variant="secondary" className="text-emerald-400">{p}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Notifications</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <motion.span key={`t${total}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{total}</motion.span> total ·{' '}
            <motion.span key={`u${unreadCount}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-primary">{unreadCount} unread</motion.span>
          </p>
        </div>
        <div className="flex gap-2">
          <MagneticButton variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => void markAllRead()}>Mark all read</MagneticButton>
          <MagneticButton variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => void deleteAll()}>Delete all</MagneticButton>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 h-8 text-sm bg-secondary border-0"
          />
        </div>
        <select
          value={filterApp}
          onChange={e => setFilterApp(e.target.value)}
          className="h-8 px-2 text-xs rounded-md bg-secondary text-foreground border-0 cursor-pointer"
        >
          <option value="">All apps</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={filterRead}
          onChange={e => setFilterRead(e.target.value)}
          className="h-8 px-2 text-xs rounded-md bg-secondary text-foreground border-0 cursor-pointer"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="h-8 px-2 text-xs rounded-md bg-secondary text-foreground border-0 cursor-pointer"
        >
          <option value="">Any priority</option>
          {[...Array(11).keys()].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {hasFilters && (
          <motion.button
            onClick={clearFilters}
            className="h-8 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          >
            <XIcon className="w-3 h-3" /> Clear
          </motion.button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        {notifs.length === 0 && (
          <motion.p className="text-center py-16 text-muted-foreground text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {hasFilters ? 'No notifications match your filters.' : 'No notifications yet.'}
          </motion.p>
        )}
        <motion.div
          className="space-y-2 pr-3"
          key={`${offset}-${search}-${filterApp}-${filterRead}-${filterPriority}`}
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        >
          <AnimatePresence initial={false}>
            {notifs.map(n => (
              <motion.div key={n.id} variants={listItem} exit="exit" layout transition={{ layout: { duration: 0.2 } }}>
                <Card className={`border-0 bg-card transition-all duration-200 hover:bg-accent/60 ${!n.read ? 'card-glow-amber' : 'card-glow'}`}>
                  <CardContent className="p-4 flex gap-3 items-start">
                    <div className="mt-0.5 shrink-0">{priorityBadge(n.priority)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                      <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{n.message}</p>
                      <div className="flex gap-2 mt-2 items-center flex-wrap">
                        <span className="bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5 rounded-full">{n.app?.name ?? String(n.app_id)}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                        {n.read && <span className="text-[11px] text-muted-foreground/60">✓</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!n.read && (
                        <motion.button onClick={() => void markRead(n.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" whileHover={{ scale: 1.1 }} title="Mark read">
                          <CheckIcon className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      <motion.button onClick={() => void deleteNotif(n.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors" whileHover={{ scale: 1.2 }} title="Delete">
                        <Trash2Icon className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </ScrollArea>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <MagneticButton variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>← Prev</MagneticButton>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {pages}</span>
          <MagneticButton variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setOffset(o => o + LIMIT)}>Next →</MagneticButton>
        </div>
      )}
    </div>
  );
}
