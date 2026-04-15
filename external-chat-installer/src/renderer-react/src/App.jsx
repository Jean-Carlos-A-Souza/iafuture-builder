import React from 'react';
import { useDesktopApp } from './context/DesktopAppContext';
import ChatLayout from './components/ChatLayout';
import ConfirmDialog from './components/ConfirmDialog';
import DiagnosticsModal from './components/DiagnosticsModal';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SplashScreen from './components/SplashScreen';

export default function App() {
  const { state, actions } = useDesktopApp();

  return (
    <>
      <SplashScreen config={state.config} visible={state.isInitialLoading} />

      <div className="app-shell">
        <Header config={state.config} runtimeState={state.runtimeState} />

        <main className="workspace">
          <Sidebar
            conversations={state.filteredConversations}
            activeConversationId={state.activeConversationId}
            draftVisible={state.draftVisible}
            searchTerm={state.searchTerm}
            onSearchChange={actions.setSearchTerm}
            onNewConversation={actions.startNewConversation}
            onOpenConversation={(conversationId) => actions.loadConversation(conversationId, { preferCache: true, silentBackgroundRefresh: true })}
            onDeleteConversation={actions.requestDeleteConversation}
          />

          <ChatLayout
            activeConversation={state.activeConversation}
            messages={state.messages}
            selectedReference={state.selectedReference}
            selectedAction={state.selectedAction}
            moreActionsEnabled={state.moreActionsEnabled}
            isSending={state.isSending}
            placeholder={state.placeholder}
            actionLabel={actions.actionLabel}
            onReference={actions.setReference}
            onClearReference={actions.clearReference}
            onSubmit={actions.askQuestion}
          />
        </main>
      </div>

      <ConfirmDialog
        open={!!state.confirmDeleteConversationId}
        onCancel={actions.cancelDeleteConversation}
        onConfirm={actions.confirmDeleteConversation}
      />

      <DiagnosticsModal
        open={state.diagnosticsOpen}
        diagnostics={state.diagnostics}
        onClose={() => actions.setDiagnosticsOpen(false)}
      />
    </>
  );
}
