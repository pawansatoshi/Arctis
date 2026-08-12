'use client';

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 500);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
      className="fixed right-4 bottom-5 sm:right-6 sm:bottom-6 z-[35] w-10 h-10 rounded-full border border-black/[0.08] dark:border-white/[0.10] bg-surface-0/90 dark:bg-surface-200/90 backdrop-blur-xl shadow-lg shadow-black/10 text-surface-700 hover:text-surface-950 hover:border-blue-500/30 hover:bg-surface-0 dark:hover:bg-surface-200 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
    >
      <ChevronUp className="w-4 h-4 mx-auto" />
    </button>
  );
}
