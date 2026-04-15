import React from 'react';

export default function ConfirmDialog({ open, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card confirm-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="section-kicker">Confirmacao</span>
            <h2>Apagar conversa</h2>
          </div>
        </div>
        <p className="modal-copy">Deseja realmente apagar esta conversa?</p>
        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>Cancelar</button>
          <button type="button" className="danger-button" onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}
