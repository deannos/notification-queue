import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { App } from '../types';
import { MagneticButton } from './MagneticButton';
import { Modal } from './Modal';

const listItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: [0.23, 1, 0.32, 1] as const, duration: 0.35 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export function AppPanel() {
  const [apps, setApps] = useState<App[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [newToken, setNewToken] = useState('');
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get<App[]>('/api/v1/application');
      setApps(data ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => { void load(); }, []);

  const openModal = () => {
    setName(''); setDesc(''); setNewToken(''); setCreated(false); setError('');
    setShowModal(true);
  };

  const createApp = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      const app = await api.post<App>('/api/v1/application', { name: name.trim(), description: desc });
      setNewToken(app.token ?? '');
      setCreated(true);
      void load();
    } catch (err) { setError((err as Error).message); }
  };

  const deleteApp = async (id: number) => {
    if (!confirm('Delete this application and all its notifications?')) return;
    await api.del(`/api/v1/application/${id}`);
    setApps(prev => prev.filter(a => a.id !== id));
  };

  const rotateToken = async (id: number) => {
    if (!confirm('Rotate the token? The old token will stop working immediately.')) return;
    const data = await api.post<{ token: string }>(`/api/v1/application/${id}/token`);
    alert(`New token (save this — it won't be shown again):\n\n${data.token}`);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Applications</h2>
        <MagneticButton size="sm" variant="primary" onClick={openModal}>+ New App</MagneticButton>
      </div>

      {apps.length === 0 && (
        <div className="empty-state">No applications yet. Create one to start sending notifications.</div>
      )}

      <motion.div
        className="app-list"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <AnimatePresence initial={false}>
          {apps.map(a => (
            <motion.div
              key={a.id}
              className="app-card"
              variants={listItem}
              exit="exit"
              layout
              whileHover={{ y: -2, boxShadow: '0 6px 28px rgba(108,99,255,0.12)', borderColor: 'var(--accent)' }}
            >
              <div className="app-icon">🔑</div>
              <div className="app-info">
                <div className="app-name">{a.name}</div>
                <div className="app-desc">{a.description}</div>
                <div className="app-id">ID: {a.id}</div>
              </div>
              <div className="app-actions">
                <MagneticButton size="sm" onClick={() => void rotateToken(a.id)}>Rotate Token</MagneticButton>
                <MagneticButton size="sm" variant="danger" onClick={() => void deleteApp(a.id)}>Delete</MagneticButton>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <Modal
        open={showModal}
        title="Create Application"
        onCancel={() => { setShowModal(false); }}
        onConfirm={created ? undefined : () => void createApp()}
        confirmLabel="Create"
        confirmDisabled={created}
      >
        {!created ? (
          <>
            <div className="field">
              <label>Name</label>
              <input type="text" placeholder="My Service" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Description</label>
              <input type="text" placeholder="What sends notifications here?" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            {error && <div className="error-msg">{error}</div>}
          </>
        ) : (
          <motion.div
            className="token-box"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.23, 1, 0.32, 1], duration: 0.4 }}
          >
            <p><strong>Save your token — it won't be shown again:</strong></p>
            <code>{newToken}</code>
            <MagneticButton size="sm" onClick={() => void navigator.clipboard.writeText(newToken)}>Copy</MagneticButton>
          </motion.div>
        )}
      </Modal>
    </div>
  );
}
