import React from 'react';
import MessageList from './MessageList';
import Composer from './Composer';

export default function ChatLayout({
  activeConversation,
  messages,
  selectedReference,
  selectedAction,
  moreActionsEnabled,
  isSending,
  placeholder,
  actionLabel,
  onReference,
  onClearReference,
  onSubmit,
}) {
  return (
    <section className="workspace-main">
      <div className="chat-stage">
        <div className="chat-stage-header">
          <div>
            <span className="section-kicker">Atendimento</span>
            <h2>{activeConversation ? 'Conversa ativa' : 'Nova conversa'}</h2>
          </div>
          <span className="conversation-badge">
            {activeConversation ? 'Conversa selecionada' : 'Pronta para iniciar'}
          </span>
        </div>

        <MessageList
          messages={messages}
          selectedReference={selectedReference}
          selectedAction={selectedAction}
          moreActionsEnabled={moreActionsEnabled}
          onReference={onReference}
          actionLabel={actionLabel}
        />

        <Composer
          placeholder={placeholder}
          isSending={isSending}
          selectedReference={selectedReference}
          selectedActionLabel={selectedAction ? `Acao selecionada: ${actionLabel(selectedAction)}` : null}
          onClearReference={onClearReference}
          onSubmit={onSubmit}
        />
      </div>
    </section>
  );
}
