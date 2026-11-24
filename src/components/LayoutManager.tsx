import { useLocation } from 'react-router-dom';
import { useGlobalRadio } from '@/lib/global-radio';

interface LayoutManagerProps {
  children: React.ReactNode;
}

export function LayoutManager({ children }: LayoutManagerProps) {
  const globalRadio = useGlobalRadio();
  const location = useLocation();

  // Distraction-free / dedicated footer routes (e.g. Mushaf reader) manage their own bottom clearance
  const isReaderRoute = location.pathname.startsWith('/quran/') && location.pathname !== '/quran';

  return (
    <main
      className="flex-1 min-h-0 overflow-y-auto interactive-layer relative bg-transparent"
      style={{
        paddingBottom: isReaderRoute
          ? '0px'
          : 'calc(84px + env(safe-area-inset-bottom, 0px) + var(--tilawah-dock-space, 0px))',
      }}
      id="main-content"
      role="main"
    >
      {/* Non-fixed top aura that scrolls naturally with page content */}
      <div className="theme-top-aura" aria-hidden="true" />
      {children}
    </main>
  );
}