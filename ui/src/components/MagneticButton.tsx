import { motion, type HTMLMotionProps } from 'framer-motion';
import { useAntiGravity } from '../hooks/useAntiGravity';

interface Props extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md';
  block?: boolean;
}

export function MagneticButton({ variant = 'outline', size = 'md', block, className = '', children, ...rest }: Props) {
  const { x, y, onMouseMove, onMouseLeave } = useAntiGravity(8);
  const cls = ['btn',
    variant === 'primary' && 'btn-primary',
    variant === 'danger' && 'btn-danger',
    variant === 'outline' && 'btn-outline',
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  ].filter(Boolean).join(' ');
  return (
    <motion.button
      className={cls}
      style={{ x, y }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      whileTap={{ scale: 0.96 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
