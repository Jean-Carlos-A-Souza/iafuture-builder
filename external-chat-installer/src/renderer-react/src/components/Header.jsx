import React from 'react';

export default function Header({ config, runtimeState }) {
  const iconUrl = config.iconUrl || config.logoUrl || null;
  const title = config.chatAppName || 'Chat Desktop';
  const showPoweredBy = config.showPoweredBy !== false;

  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-avatar">
          {iconUrl ? <img src={iconUrl} alt="Logo do sistema" /> : <span className="brand-avatar-text">K</span>}
        </div>
        <div className="brand-copy">
          <span className="section-kicker">Desktop App</span>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="header-actions">
        <span className={`runtime-badge is-${runtimeState.status}`}>{runtimeState.label}</span>
        {showPoweredBy ? <span className="brand-badge">Powered by Kryon IA</span> : null}
      </div>
    </header>
  );
}
