import React from 'react';
import ConversationItem from './ConversationItem';

export default function Sidebar({
  conversations,
  activeConversationId,
  draftVisible,
  searchTerm,
  onSearchChange,
  onNewConversation,
  onOpenConversation,
  onDeleteConversation,
}) {
  return (
    <aside className="workspace-sidebar">
      <section className="sidebar-card sidebar-card-header">
        <div>
          <span className="section-kicker">Historico</span>
          <h2>Conversas</h2>
        </div>
        <button type="button" className="primary-button" onClick={onNewConversation}>Nova conversa</button>
      </section>

      <section className="sidebar-card sidebar-card-list">
        <div className="sidebar-meta">
          <label className="history-search-wrap">
            <span className="visually-hidden">Buscar conversa</span>
            <input
              type="search"
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
          <span className="sidebar-meta-copy">
            {conversations.length > 0 ? `${conversations.length} conversa(s) visiveis neste historico.` : 'Sem conversas salvas ainda.'}
          </span>
        </div>

        <div className="conversation-list">
          {draftVisible ? (
            <article className={`conversation-draft ${!activeConversationId ? 'is-active' : ''}`}>
              <button type="button" className="conversation-trigger" onClick={onNewConversation}>
                <span className="conversation-title">Nova conversa</span>
              </button>
            </article>
          ) : null}

          {conversations.length === 0 ? (
            <div className="conversation-empty">Nenhuma conversa registrada ainda. Inicie a primeira pergunta para preencher o historico.</div>
          ) : (
            conversations.map((item) => (
              <ConversationItem
                key={item.conversation_id}
                item={item}
                active={item.conversation_id === activeConversationId}
                onOpen={onOpenConversation}
                onDelete={onDeleteConversation}
              />
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
