import { createContext, useContext } from 'react';
import { useDesktopChat } from '../hooks/useDesktopChat';

const DesktopAppContext = createContext(null);

export function DesktopAppProvider({ children }) {
  const value = useDesktopChat();
  return (
    <DesktopAppContext.Provider value={value}>
      {children}
    </DesktopAppContext.Provider>
  );
}

export function useDesktopApp() {
  const context = useContext(DesktopAppContext);
  if (!context) {
    throw new Error('useDesktopApp must be used within DesktopAppProvider');
  }

  return context;
}
