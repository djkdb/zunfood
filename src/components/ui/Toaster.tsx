import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/store/toastStore';
import { cn } from '@/lib/cn';

/** 화면 상단에 뜨는 알림 스택 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-toast mx-auto flex w-full max-w-[440px] flex-col items-center gap-2 px-5"
      style={{ paddingTop: 'calc(66px + env(safe-area-inset-top))' }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              'pointer-events-auto flex max-w-full items-center gap-2 rounded-full px-4 py-2.5 shadow-lift',
              item.tone === 'error'
                ? 'bg-danger text-white'
                : item.tone === 'success'
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-900 text-white',
            )}
          >
            {item.icon && <span className="text-[16px]">{item.icon}</span>}
            <span className="truncate text-[14px] font-bold">{item.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
