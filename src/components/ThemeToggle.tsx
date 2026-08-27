import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  /** Extra positioning classes when embedding outside a flex row. */
  className?: string;
}

/**
 * App-wide colour-mode switch. Reads/writes through ThemeContext so the
 * choice persists (localStorage 'theme') and applies to every page.
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'group p-2.5 rounded-xl text-gray-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/70 dark:hover:bg-zinc-800/70 shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-zinc-800 transition-all active:scale-90',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -120, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 120, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="block"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}