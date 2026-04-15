import React from 'react';

export default function DiagnosticsModal({ open, diagnostics, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card diagnostics-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="section-kicker">Diagnostico</span>
            <h2>Suporte tecnico</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>Fechar</button>
        </div>
        <p className="modal-copy">Use Ctrl + Shift + S para abrir ou fechar este painel.</p>
        <div className="diagnostics-list">
          {diagnostics.map((entry, index) => (
            <article key={`${entry.title}-${index}`} className="diagnostic-entry">
              <strong>{entry.title}</strong>
              <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
