import { useEffect, ReactNode } from 'react';

interface SecurityWrapperProps {
  children: ReactNode;
}

export function SecurityWrapper({ children }: SecurityWrapperProps) {
  useEffect(() => {
    // Basic security without interfering with forms
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Never interfere with any input elements
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Block developer tools shortcuts only outside forms
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && ['I', 'C', 'J'].includes(e.key))) {
        e.preventDefault();
      }
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      // Never interfere with input elements
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  return (
    <div className="w-full h-full" style={{ 
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitTapHighlightColor: 'transparent'
    }}>
      <style>{`
        input, textarea, [contenteditable="true"] {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
      `}</style>
      {children}
    </div>
  );
}