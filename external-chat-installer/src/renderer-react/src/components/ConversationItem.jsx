import React from 'react';
import { buildConversationTitle } from '../services/messages';

export default function ConversationItem({ item, active, onOpen, onDelete }) {
  const title = buildConversationTitle(item);

  return (
    <article className={`conversation-item ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className="conversation-trigger"
        onClick={() => onOpen(item.conversation_id)}
      >
        <span className="conversation-title" title={title}>{title}</span>
      </button>
      <div className="conversation-actions">
        <button
          type="button"
          className="icon-button conversation-delete"
          aria-label="Apagar conversa"
          title="Apagar conversa"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item.conversation_id);
          }}
        >
          &#128465;
        </button>
      </div>
    </article>
  );
}
