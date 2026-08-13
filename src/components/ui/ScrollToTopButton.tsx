'use client';

import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import HelpGuide from '@/components/ui/HelpGuide';

function getNestedScrollContainers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.overflow-y-auto, .overflow-auto')).filter((element) => element.scrollHeight > element.clientHeight + 10);
}

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 500 || getNestedScrollContainers().some((element) => element.scrollTop > 350));
    const attach = () => {
      update();
      const nested = getNestedScrollContainers();
      nested.forEach((element) => element.addEventListener('scroll', update, { passive: true }));
      return nested;
    };
    let attached = attach();
    let refreshTimer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        attached.forEach((element) => element.removeEventListener('scroll', update));
        attached = attach();
      }, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('scroll', update);
      attached.forEach((element) => element.removeEventListener('scroll', update));
      observer.disconnect();
    };
  }, []);

  const scrollToTop = () => {
    if (window.scrollY > 10) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const nested = getNestedScrollContainers().filter((element) => element.scrollTop > 10).sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
    nested[0]?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <HelpGuide />
      {visible && (
        <button type="button" onClick={scrollToTop} aria-label="Back to top" title="Back to top" className="fixed right-4 bottom-20 sm:right-6 sm:bottom-20 z-[35] w-10 h-10 rounded-full border border-black/[0.08] dark:border-white/[0.10] bg-surface-0/90 dark:bg-surface-200/90 backdrop-blur-xl shadow-lg shadow-black/10 text-surface-700 hover:text-surface-950 hover:border-blue-500/30 hover:bg-surface-0 dark:hover:bg-surface-200 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
          <ChevronUp className="w-4 h-4 mx-auto" />
        </button>
      )}
    </>
  );
}
