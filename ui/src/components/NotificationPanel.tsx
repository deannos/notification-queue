import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { Notification } from '../types';
import { MagneticButton } from './MagneticButton';

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

  const load = useCallback(async (off: number) => {
    try {
      const data = await api.get<{ notifications: Notification[]; total: number }>(
        `/api/v1/notification?limit=${LIMIT}&offset=${off}`
      );
      setNotifs(data.notifications ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(offset); }, [offset, load]);

  useEffect(() => {
    if (!liveNotif) return;
    setNotifs(prev => [liveNotif, ...prev]);
    setTotal(t => t + 1);
    onLiveConsumed();
  }, [liveNotif, onLiveConsumed]);

  const markRead = async (id: number) => {
    await api.put(`/api/v1/notification/${id}/read`);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotif = async (id: number) => {
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

  const pages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Notifications</h2>
        <div className="panel-actions">
          <MagneticButton size="sm" onClick={() => void markAllRead()}>Mark all read</MagneticButton>
          <MagneticButton size="sm" variant="danger" onClick={() => void deleteAll()}>Delete all</MagneticButton>
        </div>
      </div>

      <div className="sidebar-stats" style={{ marginBottom: 16, border: 'none', paddingTop: 0, marginTop: 0 }}>
        <div className="stat">
          <motion.span key={`t${total}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>{total}</motion.span>
          <small>Total</small>
        </div>
        <div className="stat">
          <motion.span key={`u${unreadCount}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>{unreadCount}</motion.span>
          <small>Unread</small>
        </div>
      </div>

      {notifs.length === 0 && <div className="empty-state">No notifications yet.</div>}

      <motion.div
        className="notif-list"
        key={offset}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      >
        <AnimatePresence initial={false}>
          {notifs.map(n => {
            const pri = n.priority >= 8 ? 'high' : n.priority >= 4 ? 'mid' : 'low';
            return (
              <motion.div
                key={n.id}
                className={`notif-card${n.read ? '' : ' unread'}`}
                variants={listItem}
                exit="exit"
                layout
                whileHover={{ y: -2, boxShadow: '0 6px 28px rgba(108,99,255,0.18)', borderColor: 'var(--accent)' }}
                transition={{ layout: { duration: 0.2 } }}
              >
                <div className={`notif-priority priority-${pri}`}>{n.priority}</div>
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-message">{n.message}</div>
                  <div className="notif-meta">
                    <span className="notif-app-tag">{n.app?.name ?? String(n.app_id)}</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.read && <span>✓ read</span>}
                  </div>
                </div>
                <div className="notif-actions">
                  {!n.read && (
                    <motion.button onClick={() => void markRead(n.id)} title="Mark read" whileHover={{ scale: 1.2, opacity: 1 }} style={{ opacity: 0.5 }}>✓</motion.button>
                  )}
                  <motion.button onClick={() => void deleteNotif(n.id)} title="Delete" whileHover={{ scale: 1.2, opacity: 1 }} style={{ opacity: 0.5 }}>🗑</motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {pages > 1 && (
        <div className="pagination">
          <MagneticButton size="sm" disabled={currentPage <= 1} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>← Prev</MagneticButton>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Page {currentPage} of {pages}</span>
          <MagneticButton size="sm" disabled={currentPage >= pages} onClick={() => setOffset(o => o + LIMIT)}>Next →</MagneticButton>
        </div>
      )}
    </div>
  );
}
