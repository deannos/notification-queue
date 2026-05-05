import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import type { User } from '@/types';
import { MagneticButton } from './MagneticButton';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircleIcon, Trash2Icon } from 'lucide-react';

const listItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: [0.23, 1, 0.32, 1] as const, duration: 0.35 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export function UserPanel() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/api/v1/user').then(d => d ?? []),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/api/v1/user', { username, password, is_admin: isAdmin }),
    onSuccess: () => {
      setShowModal(false);
      toast.success(`User "${username}" created`);
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setFormError((err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/v1/user/${id}`),
    onMutate: (id) => {
      qc.setQueryData<User[]>(['users'], prev => prev?.filter(u => u.id !== id));
    },
    onSuccess: () => toast.success('User deleted'),
    onError: () => { toast.error('Failed to delete user'); void qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const openModal = () => {
    setUsername(''); setPassword(''); setIsAdmin(false); setFormError('');
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Users</h2>
        <MagneticButton size="sm" onClick={openModal}>+ New User</MagneticButton>
      </div>

      {users.length === 0 && <p className="text-center py-10 text-muted-foreground">No users.</p>}

      <motion.div
        className="space-y-2.5"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <AnimatePresence initial={false}>
          {users.map(u => (
            <motion.div key={u.id} variants={listItem} exit="exit" layout>
              <Card className="border-0 bg-card card-glow hover:bg-accent/60 transition-all duration-200">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                    <UserCircleIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      {u.username}
                      {u.is_admin && <span className="bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5 rounded-full">admin</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Created: {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <MagneticButton variant="destructive" size="sm" onClick={() => setDeleteUserId(u.id)}>
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </MagneticButton>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <ConfirmDialog
        open={!!deleteUserId}
        title="Delete user?"
        description="This will permanently delete the user and all their data."
        confirmLabel="Delete"
        onConfirm={() => { deleteMut.mutate(deleteUserId!); }}
        onCancel={() => setDeleteUserId(null)}
      />

      <Modal
        open={showModal}
        title="Create User"
        onCancel={() => setShowModal(false)}
        onConfirm={() => createMut.mutate()}
        confirmDisabled={createMut.isPending}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="rounded" />
            Admin
          </label>
          {formError && <p className="text-destructive text-xs">{formError}</p>}
        </div>
      </Modal>
    </div>
  );
}
