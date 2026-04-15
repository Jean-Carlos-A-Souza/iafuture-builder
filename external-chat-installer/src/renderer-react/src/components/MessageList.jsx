import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AVAILABLE_ACTIONS } from '../services/messages';

function TypingIndicator() {
  return (
    <div className="typing-dots" aria-hidden="true">
      <span /><span /><span />
    </div>
  );
}

function MessageActions({ message, selectedReference, selectedAction, moreActionsEnabled, onReference, actionLabel }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const shellRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClick = (event) => {
      if (shellRef.current && !shellRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  return (
    <div ref={shellRef} className={`message-actions-shell ${menuOpen ? 'has-open-menu' : ''}`}>
      <button
        type="button"
        className={`message-icon-button ${selectedReference?.id === message.id && !selectedAction ? 'is-active' : ''}`}
        aria-label="Referenciar mensagem"
        onClick={() => {
          setMenuOpen(false);
          onReference(message, null);
        }}
      >
        &#10551;
      </button>

      {moreActionsEnabled ? (
        <>
          <button
            type="button"
            className={`message-icon-button message-menu-trigger ${menuOpen ? 'is-active' : ''}`}
            aria-label="Abrir acoes da mensagem"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((current) => !current);
            }}
          >
            &hellip;
          </button>

          <div className={`message-action-menu ${menuOpen ? 'is-open' : ''}`}>
            {AVAILABLE_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                className={`message-action-menu-item ${selectedReference?.id === message.id && selectedAction === action ? 'is-active' : ''}`}
                onClick={() => {
                  setMenuOpen(false);
                  onReference(message, action);
                }}
              >
                {actionLabel(action)}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MessageBubble({ message, selectedReference, selectedAction, moreActionsEnabled, onReference, actionLabel }) {
  const roleClass = message.role === 'assistant' || message.role === 'system' ? message.role : 'user';
  const shouldShowMeta = message.role !== 'system' && !(message.role === 'assistant' && message.isTyping);
  const shouldShowTypingOnly = message.isThinking && !String(message.content || '').trim();

  return (
    <article className={`message-group ${roleClass}`}>
      <div className={`message-frame ${roleClass} ${message.isThinking ? 'is-thinking' : ''}`}>
        <div className={`message-card ${selectedReference?.id === message.id ? 'selected' : ''} ${message.isThinking ? 'is-thinking' : ''}`}>
          {message.target_message_id ? (
            <div className="message-reference-tag">
              {message.action ? `Referencia ${message.action}` : 'Referencia'}
            </div>
          ) : null}
          <div>{shouldShowTypingOnly ? <TypingIndicator /> : message.content}</div>
        </div>

        {shouldShowMeta ? (
          <div className="message-meta-row">
            <span className="message-meta">
              {message.created_at ? new Date(message.created_at).toLocaleString('pt-BR') : 'Agora'}
            </span>
            {message.role === 'assistant' && message.id ? (
              <MessageActions
                message={message}
                selectedReference={selectedReference}
                selectedAction={selectedAction}
                moreActionsEnabled={moreActionsEnabled}
                onReference={onReference}
                actionLabel={actionLabel}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function MessageList({ messages, selectedReference, selectedAction, moreActionsEnabled, onReference, actionLabel }) {
  const containerRef = useRef(null);
  const renderedMessages = useMemo(() => messages || [], [messages]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [renderedMessages]);

  return (
    <section ref={containerRef} className="chat-window" aria-live="polite">
      {renderedMessages.map((message) => (
        <MessageBubble
          key={message.id || `${message.role}-${message.created_at}-${message.content}`}
          message={message}
          selectedReference={selectedReference}
          selectedAction={selectedAction}
          moreActionsEnabled={moreActionsEnabled}
          onReference={onReference}
          actionLabel={actionLabel}
        />
      ))}
    </section>
  );
}
