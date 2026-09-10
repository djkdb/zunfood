import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** 모바일 바텀시트 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full max-w-[430px] rounded-t-[28px] border-t border-white/10 bg-navy-900 px-5 pb-8 pt-3"
            style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
            {title && <h3 className="mb-4 text-center text-[19px] font-black">{title}</h3>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
