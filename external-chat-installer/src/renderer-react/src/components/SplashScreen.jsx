import React from 'react';

export default function SplashScreen({ config, visible }) {
  if (!visible) {
    return null;
  }

  const title = config.chatAppName || 'Chat Desktop';
  const iconUrl = config.iconUrl || config.logoUrl || null;
  const copy = config.firstRun
    ? 'Ajustando o ambiente, aguarde alguns instantes...'
    : 'Carregando seu ambiente...';

  return (
    <div className="splash-overlay">
      <div className="splash-content">
        <div className="splash-avatar brand-avatar">
          {iconUrl ? <img src={iconUrl} alt="Logo do sistema" /> : <span className="brand-avatar-text">K</span>}
        </div>
        <div className="splash-copy">
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        <div className="splash-loader" aria-hidden="true"><span /><span /><span /></div>
      </div>
    </div>
  );
}
