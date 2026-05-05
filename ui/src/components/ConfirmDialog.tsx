import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MagneticButton } from './MagneticButton';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm',
  variant = 'destructive', onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="text-muted-foreground">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <MagneticButton variant="outline" onClick={onCancel}>Cancel</MagneticButton>
          <MagneticButton variant={variant} onClick={() => { onConfirm(); onCancel(); }}>{confirmLabel}</MagneticButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
