import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { BellIcon, KeyRoundIcon, UsersIcon, SunIcon, MoonIcon, LogOutIcon } from 'lucide-react';

interface Action {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  theme: 'dark' | 'light';
  onNavigate: (panel: 'notifications' | 'apps' | 'users') => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export function CommandPalette({ open, onClose, isAdmin, theme, onNavigate, onToggleTheme, onLogout }: Props) {
  const close = () => onClose();

  const actions: Action[] = [
    {
      id: 'nav-notifications',
      label: 'Go to Notifications',
      group: 'Navigate',
      icon: <BellIcon className="w-4 h-4" />,
      run: () => { onNavigate('notifications'); close(); },
    },
    {
      id: 'nav-apps',
      label: 'Go to Applications',
      group: 'Navigate',
      icon: <KeyRoundIcon className="w-4 h-4" />,
      run: () => { onNavigate('apps'); close(); },
    },
    ...(isAdmin ? [{
      id: 'nav-users',
      label: 'Go to Users',
      group: 'Navigate',
      icon: <UsersIcon className="w-4 h-4" />,
      run: () => { onNavigate('users'); close(); },
    }] : []),
    {
      id: 'theme-toggle',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      group: 'Preferences',
      icon: theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />,
      run: () => { onToggleTheme(); close(); },
    },
    {
      id: 'logout',
      label: 'Logout',
      group: 'Account',
      icon: <LogOutIcon className="w-4 h-4" />,
      run: () => { onLogout(); close(); },
    },
  ];

  const groups = [...new Set(actions.map(a => a.group))];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-[480px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command>
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Command.Input
                placeholder="Type a command or search…"
                className="flex h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            {/* Results */}
            <Command.List className="max-h-72 overflow-y-auto overflow-x-hidden p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No commands found.
              </Command.Empty>
              {groups.map(group => (
                <Command.Group key={group} heading={group} className="mb-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group}
                  </div>
                  {actions.filter(a => a.group === group).map(action => (
                    <Command.Item
                      key={action.id}
                      value={action.label}
                      onSelect={action.run}
                      // onPointerDown fires before Radix Dialog's dismissable-layer
                      // handler, ensuring the action runs even if the dialog starts closing
                      onPointerDown={(e) => { e.preventDefault(); action.run(); }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <span className="text-muted-foreground shrink-0">{action.icon}</span>
                      {action.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>

            {/* Footer hints */}
            <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> navigate
              <kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">↵</kbd> select
              <kbd className="bg-secondary px-1.5 py-0.5 rounded text-[10px] ml-auto">esc</kbd> close
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
