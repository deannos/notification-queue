import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { User } from '../types';
import { MagneticButton } from './MagneticButton';
import { Modal } from './Modal';

const listItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: [0.23, 1, 0.32, 1] as const, duration: 0.35 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export function UserPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get<User[]>('/api/v1/user');
      setUsers(data ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => { void load(); }, []);

  const createUser = async () => {
    setError('');
    try {
      await api.post('/api/v1/user', { username, password, is_admin: isAdmin });
      setShowModal(false);
      void load();
    } catch (err) { setError((err as Error).message); }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Delete this user and all their data?')) return;
    await api.del(`/api/v1/user/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Users</h2>
        <MagneticButton size="sm" variant="primary" onClick={() => { setUsername(''); setPassword(''); setIsAdmin(false); setError(''); setShowModal(true); }}>+ New User</MagneticButton>
      </div>

      {users.length === 0 && <div className="empty-state">No users.</div>}

      <motion.div
        className="app-list"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <AnimatePresence initial={false}>
          {users.map(u => (
            <motion.div
              key={u.id}
              className="app-card"
              variants={listItem}
              exit="exit"
              layout
              whileHover={{ y: -2, boxShadow: '0 6px 28px rgba(108,99,255,0.12)', borderColor: 'var(--accent)' }}
            >
              <div className="app-icon">👤</div>
              <div className="app-info">
                <div className="app-name">{u.username} {u.is_admin ? '★' : ''}</div>
                <div className="app-desc">Created: {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div className="app-actions">
                <MagneticButton size="sm" variant="danger" onClick={() => void deleteUser(u.id)}>Delete</MagneticButton>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <Modal
        open={showModal}
        title="Create User"
        onCancel={() => setShowModal(false)}
        onConfirm={() => void createUser()}
        confirmLabel="Create"
      >
        <div className="field">
          <label>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div className="field checkbox-field">
          <label>
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} /> Admin
          </label>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </Modal>
    </div>
  );
}
