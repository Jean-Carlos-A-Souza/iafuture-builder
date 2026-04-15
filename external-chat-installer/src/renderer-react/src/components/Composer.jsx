import React, { useState } from 'react';

export default function Composer({
  placeholder,
  isSending,
  selectedReference,
  selectedActionLabel,
  onClearReference,
  onSubmit,
}) {
  const [value, setValue] = useState('');

  return (
    <div className="composer-shell">
      {selectedReference ? (
        <div className="reference-banner">
          <div className="reference-banner-head">
            <span className="reference-banner-title">{selectedReference.label || 'Mensagem referenciada'}</span>
            <button type="button" className="ghost-button" onClick={onClearReference}>Fechar</button>
          </div>
          <div className="reference-banner-copy">{String(selectedReference.content || '').slice(0, 220)}</div>
          <div className="reference-banner-meta">
            {selectedActionLabel || 'Envie uma pergunta sobre a mensagem referenciada.'}
          </div>
        </div>
      ) : null}

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          const next = value.trim();
          if (!next) {
            return;
          }
          onSubmit(next);
          setValue('');
        }}
      >
        <label className="chat-input-wrap">
          <span className="visually-hidden">Digite sua pergunta</span>
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            disabled={isSending}
          />
        </label>
        <button type="submit" className="send-button" disabled={isSending}>
          {isSending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
