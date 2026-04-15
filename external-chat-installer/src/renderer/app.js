(function () {
  const config = window.KRYON_DESKTOP_CONFIG || {};
  const api = window.KRYON_DESKTOP_API;
  const diagnostics = window.KRYON_DESKTOP_DIAGNOSTICS || {};
  const body = document.body;
  const root = document.documentElement;
  const chatWindow = document.getElementById('chat-window');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const newChatButton = document.getElementById('new-chat-button');
  const conversationList = document.getElementById('conversation-list');
  const historySummary = document.getElementById('history-summary');
  const historySearch = document.getElementById('history-search');
  const referenceBanner = document.getElementById('reference-banner');
  const runtimeBadge = document.getElementById('runtime-badge');
  const conversationBadge = document.getElementById('conversation-badge');
  const poweredBy = document.getElementById('powered-by');
  const brandAvatar = document.getElementById('brand-avatar');
  const brandName = document.getElementById('brand-name');
  const splashAvatar = document.getElementById('splash-avatar');
  const splashName = document.getElementById('splash-name');
  const diagnosticsModal = document.getElementById('diagnostics-modal');
  const diagnosticsClose = document.getElementById('diagnostics-close');
  const diagnosticPanel = document.getElementById('diagnostic-panel');
  const confirmModal = document.getElementById('confirm-modal');
  const confirmCopy = document.getElementById('confirm-copy');
  const confirmCancel = document.getElementById('confirm-cancel');
  const confirmAccept = document.getElementById('confirm-accept');
  const bindingCode = config.bindingCode || null;
  const availableActions = ['improve', 'rewrite', 'summarize', 'expand', 'shorten'];
  const historyCache = new Map();
  const prefetchedConversations = new Set();

  let sessionToken = null;
  let installationKey = null;
  let installationId = null;
  let conversationId = null;
  let selectedReference = null;
  let selectedAction = null;
  let conversations = [];
  let isSending = false;
  let welcomeRendered = false;
  let activeActionMenuId = null;
  let searchTerm = '';
  let draftVisible = false;
  let pendingReplyNode = null;
  let pendingDeleteConversationId = null;
  let persistedStore = {};

  applyBranding();
  setRuntimeState('loading', 'Conectando');
  renderReferenceBanner();
  renderConversationList();
  appendDiagnostic('Inicializacao', {
    apiBaseUrl: diagnostics.environment && diagnostics.environment.apiBaseUrl ? diagnostics.environment.apiBaseUrl : null,
    bindingCode: diagnostics.environment && diagnostics.environment.bindingCode ? diagnostics.environment.bindingCode : null,
    preloadError: diagnostics.preloadError || null
  });

  if (!api || typeof api.bootstrap !== 'function') {
    body.classList.remove('is-loading');
    setRuntimeState('error', 'Falha de inicializacao');
    appendSystem('Nao foi possivel iniciar o aplicativo agora. Feche e tente novamente em instantes.');
    return;
  }

  bindEvents();

  hydratePersistedState()
    .then(function () {
      renderConversationList();
      if (conversationId && historyCache.has(conversationId)) {
        renderConversationMessages(historyCache.get(conversationId).messages || []);
        updateConversationBadge();
      }
    })
    .catch(function (error) {
      appendDiagnostic('Falha ao hidratar cache local', {
        error: error.message
      });
    })
    .then(bootstrap)
    .then(async function () {
      await refreshConversations();
      await loadCurrentConversation();
      primeConversationCache();
      finishInitialLoading();
      if (!chatWindow.querySelector('.message-group')) {
        appendWelcomeNote();
      }
      setRuntimeState('ready', 'Pronto');
      updateConversationBadge();
    })
    .catch(function (error) {
      finishInitialLoading();
      setRuntimeState('error', 'Erro de conexao');
      appendSystem(friendlyErrorMessage(error && error.message, 'Nao foi possivel carregar o sistema agora. Tente novamente em instantes.'));
    });

  function bindEvents() {
    newChatButton.addEventListener('click', function () {
      showDraftConversation(true);
    });

    historySearch.addEventListener('input', function () {
      searchTerm = historySearch.value.trim().toLowerCase();
      renderConversationList();
    });

    chatInput.addEventListener('input', function () {
      if (!conversationId && !draftVisible && chatInput.value.trim() !== '') {
        showDraftConversation(false);
      }
    });

    chatInput.addEventListener('blur', function () {
      window.setTimeout(function () {
        cancelDraftIfNeeded();
      }, 120);
    });

    chatForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const question = chatInput.value.trim();
      if (!question || !sessionToken || isSending) {
        return;
      }

      setSendingState(true);
      removeWelcomeNote();
      appendMessage('user', question, new Date().toISOString(), null);
      chatInput.value = '';
      draftVisible = false;
      closeActionMenu();
      pendingReplyNode = appendTypingIndicator();

      try {
        const response = await api.ask(sessionToken, {
          question,
          conversation_id: conversationId || undefined,
          target_message_id: selectedReference ? selectedReference.id : undefined,
          action: selectedAction || undefined
        });
        const data = response.data || {};

        if (!response.ok) {
          const friendlyMessage = friendlyErrorMessage(response.error || data.message, 'Nao foi possivel enviar sua mensagem agora.');
          appendDiagnostic('Falha no envio', {
            error: friendlyMessage,
            status: response.status,
            request: response.diagnostics || null
          });
          throw new Error(friendlyMessage);
        }

        conversationId = data.conversation_id || conversationId;
        persistConversationId();
        await animateAssistantReply(data.answer || 'Sem resposta.');
        await refreshConversations();
        await fetchConversationHistory(conversationId, true);
        clearReference(false);
      } catch (error) {
        removeTypingIndicator();
        appendSystem(friendlyErrorMessage(error && error.message, 'Nao foi possivel enviar sua mensagem agora.'));
      } finally {
        setSendingState(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        toggleDiagnosticsModal();
      }

      if (event.key === 'Escape') {
        closeActionMenu();
        hideDiagnosticsModal();
        closeDeleteModal();
        cancelDraftIfNeeded();
      }
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.message-actions-shell')) {
        closeActionMenu();
      }

      if (!event.target.closest('.workspace-sidebar') && !event.target.closest('.chat-form')) {
        cancelDraftIfNeeded();
      }
    });

    diagnosticsClose.addEventListener('click', function () {
      hideDiagnosticsModal();
    });

    diagnosticsModal.addEventListener('click', function (event) {
      if (event.target === diagnosticsModal) {
        hideDiagnosticsModal();
      }
    });

    confirmCancel.addEventListener('click', function () {
      closeDeleteModal();
    });

    confirmAccept.addEventListener('click', function () {
      if (!pendingDeleteConversationId) {
        closeDeleteModal();
        return;
      }

      archiveConversation(pendingDeleteConversationId).finally(closeDeleteModal);
    });

    confirmModal.addEventListener('click', function (event) {
      if (event.target === confirmModal) {
        closeDeleteModal();
      }
    });
  }

  async function bootstrap() {
    const response = await api.bootstrap({
      binding_code: bindingCode,
      installation_key: installationKey,
      machine_label: 'desktop-electron',
      platform: 'windows-electron',
      app_version: '1.0.0',
      metadata: {
        user_agent: navigator.userAgent
      }
    });
    const data = response.data || {};

    if (!response.ok) {
      const friendlyMessage = friendlyErrorMessage(response.error || data.message, 'Nao foi possivel iniciar o aplicativo agora.');
      appendDiagnostic('Falha no bootstrap', {
        error: friendlyMessage,
        status: response.status,
        request: response.diagnostics || null
      });
      throw new Error(friendlyMessage);
    }

    sessionToken = data.session_token;
    installationKey = data.installation && data.installation.installation_key ? data.installation.installation_key : installationKey;
    installationId = data.installation && data.installation.id ? data.installation.id : installationId;
    applyStoredInstallationState();

    applyBootstrapChatAppConfig(data.chat_app || null);
    persistState();

    appendDiagnostic('Bootstrap OK', {
      installationId: installationId,
      installationKey: installationKey,
      sessionExpiresAt: data.installation && data.installation.session_expires_at ? data.installation.session_expires_at : null
    });
  }

  async function refreshConversations() {
    if (!sessionToken) {
      return;
    }

    const response = await api.listConversations(sessionToken);
    const data = response.data || {};

    if (!response.ok) {
      appendDiagnostic('Falha ao listar conversas', {
        error: friendlyErrorMessage(response.error || data.message, 'Nao foi possivel atualizar o historico agora.'),
        status: response.status,
        request: response.diagnostics || null
      });
      renderConversationList();
      return;
    }

    conversations = Array.isArray(data.items) ? data.items : [];

    if (conversationId && !conversations.some(function (item) { return item.conversation_id === conversationId; })) {
      conversationId = null;
      persistConversationId();
    }

    if (!conversationId && conversations.length === 0) {
      draftVisible = true;
    }

    persistState();
    renderConversationList();
  }

  async function loadCurrentConversation() {
    if (!conversationId) {
      renderConversationList();
      updateConversationBadge();
      if (conversations.length === 0) {
        draftVisible = true;
      }
      return;
    }

    await loadConversation(conversationId, { preferCache: true, silentBackgroundRefresh: true });
  }

  async function loadConversation(nextConversationId, options = {}) {
    if (!sessionToken || !nextConversationId) {
      return;
    }

    const preferCache = options.preferCache !== false;
    const silentBackgroundRefresh = options.silentBackgroundRefresh === true;
    const cached = preferCache ? historyCache.get(nextConversationId) : null;

    conversationId = nextConversationId;
    draftVisible = false;
    persistConversationId();
    closeActionMenu();

    if (cached && Array.isArray(cached.messages)) {
      renderConversationMessages(cached.messages);
      renderConversationList();
      updateConversationBadge();
      if (silentBackgroundRefresh) {
        fetchConversationHistory(nextConversationId, false);
        return;
      }
    } else if (!silentBackgroundRefresh) {
      renderConversationSkeleton();
    }

    await fetchConversationHistory(nextConversationId, !cached);
  }

  async function fetchConversationHistory(nextConversationId, repaint) {
    const response = await api.conversationHistory(sessionToken, nextConversationId);
    const data = response.data || {};

    if (!response.ok) {
      appendDiagnostic('Falha ao carregar historico', {
        error: friendlyErrorMessage(response.error || data.message, 'Nao foi possivel carregar essa conversa agora.'),
        status: response.status,
        request: response.diagnostics || null
      });
      return;
    }

    const messages = Array.isArray(data.messages) ? data.messages : [];
    historyCache.set(nextConversationId, {
      messages: messages,
      firstUserMessage: findFirstUserMessage(messages),
      updatedAt: data.updated_at || null,
      fetchedAt: Date.now()
    });
    persistState();

    if (conversationId === nextConversationId && repaint) {
      renderConversationMessages(messages);
      renderConversationList();
      updateConversationBadge();
    }
  }

  function renderConversationMessages(messages) {
    chatWindow.innerHTML = '';
    welcomeRendered = false;

    if (Array.isArray(messages) && messages.length > 0) {
      messages.forEach(function (message) {
        appendMessage(
          message.role === 'user' ? 'user' : 'assistant',
          message.content || 'Mensagem sem conteudo',
          message.created_at || null,
          message
        );
      });
    } else {
      appendWelcomeNote();
    }

    clearReference(false);
  }

  function renderConversationSkeleton() {
    chatWindow.innerHTML = '';
    welcomeRendered = false;
    ['is-assistant', 'is-user', 'is-assistant is-wide'].forEach(function (className) {
      const node = document.createElement('div');
      node.className = `message-skeleton ${className}`;
      chatWindow.appendChild(node);
    });
  }

  function primeConversationCache() {
    conversations.slice(0, 10).forEach(function (item) {
      if (item && item.conversation_id && !prefetchedConversations.has(item.conversation_id) && !historyCache.has(item.conversation_id)) {
        prefetchedConversations.add(item.conversation_id);
        fetchConversationHistory(item.conversation_id, false).catch(function () {
          prefetchedConversations.delete(item.conversation_id);
        });
      }
    });
  }

  function showDraftConversation(focusInput) {
    draftVisible = true;
    conversationId = null;
    persistConversationId();
    renderConversationList();
    updateConversationBadge();
    if (!chatWindow.querySelector('.message-group') || !chatInput.value.trim()) {
      chatWindow.innerHTML = '';
      welcomeRendered = false;
      appendWelcomeNote();
    }
    if (focusInput) {
      chatInput.focus();
    }
  }

  function cancelDraftIfNeeded() {
    if (!draftVisible || conversationId || chatInput.value.trim() !== '' || conversations.length === 0) {
      return;
    }
    draftVisible = false;
    renderConversationList();
    updateConversationBadge();
    if (!conversationId && conversations.length > 0) {
      chatWindow.innerHTML = '';
      welcomeRendered = false;
      appendWelcomeNote();
    }
  }

  function renderConversationList() {
    if (!conversationList) {
      return;
    }

    const filtered = filterConversations();
    const items = [];

    if (draftVisible || conversations.length === 0) {
      items.push(`
        <div class="conversation-draft ${!conversationId ? 'is-active' : ''}">
          <button type="button" class="conversation-trigger" data-conversation-id="__draft__">
            <span class="conversation-title">Nova conversa</span>
          </button>
        </div>
      `);
    }

    if (filtered.length === 0) {
      items.push(`<div class="conversation-empty">${searchTerm ? 'Nenhuma conversa encontrada para essa busca.' : 'Nenhuma conversa registrada ainda. Inicie a primeira pergunta para preencher o historico.'}</div>`);
    } else {
      filtered.forEach(function (item) {
        const isActive = item.conversation_id === conversationId;
        items.push(`
          <article class="conversation-item ${isActive ? 'is-active' : ''}">
            <button type="button" class="conversation-trigger" data-conversation-id="${escapeHtml(item.conversation_id)}">
              <span class="conversation-title" title="${escapeHtml(buildConversationTitle(item))}">${escapeHtml(buildConversationTitle(item))}</span>
            </button>
            <div class="conversation-actions">
              <button type="button" class="icon-button conversation-delete" data-conversation-id="${escapeHtml(item.conversation_id)}" aria-label="Apagar conversa" title="Apagar conversa">&#128465;</button>
            </div>
          </article>
        `);
      });
    }

    conversationList.innerHTML = items.join('');
    historySummary.textContent = filtered.length > 0
      ? `${filtered.length} conversa(s) visiveis neste historico.`
      : (searchTerm ? 'Nenhum resultado encontrado.' : 'Sem conversas salvas ainda.');

    const bindOpenConversation = function (targetConversationId) {
      if (targetConversationId === '__draft__') {
        showDraftConversation(true);
        return;
      }
      if (targetConversationId === conversationId) {
        return;
      }
      loadConversation(targetConversationId, { preferCache: true, silentBackgroundRefresh: true }).catch(function (error) {
        appendSystem(friendlyErrorMessage(error && error.message, 'Nao foi possivel abrir essa conversa agora.'));
      });
    };

    conversationList.querySelectorAll('.conversation-trigger').forEach(function (button) {
      button.addEventListener('click', function () {
        bindOpenConversation(button.dataset.conversationId);
      });
    });

    conversationList.querySelectorAll('.conversation-delete').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        openDeleteModal(button.dataset.conversationId);
      });
    });
  }

  function filterConversations() {
    if (!searchTerm) {
      return conversations;
    }

    return conversations.filter(function (item) {
      const title = buildConversationTitle(item).toLowerCase();
      const preview = (buildConversationPreview(item) || '').toLowerCase();
      return title.includes(searchTerm) || preview.includes(searchTerm);
    });
  }

  function openDeleteModal(targetConversationId) {
    pendingDeleteConversationId = targetConversationId;
    confirmCopy.textContent = 'Deseja realmente apagar esta conversa?';
    confirmModal.classList.remove('hidden');
    confirmModal.setAttribute('aria-hidden', 'false');
  }

  function closeDeleteModal() {
    pendingDeleteConversationId = null;
    confirmModal.classList.add('hidden');
    confirmModal.setAttribute('aria-hidden', 'true');
  }

  async function archiveConversation(targetConversationId) {
    const previousConversationId = conversationId;
    const nextFallbackConversation = conversations.find(function (item) {
      return item.conversation_id !== targetConversationId;
    });

    conversations = conversations.filter(function (item) {
      return item.conversation_id !== targetConversationId;
    });
    historyCache.delete(targetConversationId);
    prefetchedConversations.delete(targetConversationId);

    if (conversationId === targetConversationId) {
      conversationId = nextFallbackConversation ? nextFallbackConversation.conversation_id : null;
      persistConversationId();

      if (conversationId && historyCache.has(conversationId)) {
        renderConversationMessages(historyCache.get(conversationId).messages || []);
      } else {
        chatWindow.innerHTML = '';
        welcomeRendered = false;
        appendWelcomeNote();
      }
      updateConversationBadge();
    }

    persistState();
    renderConversationList();

    const response = await api.archiveConversation(sessionToken, targetConversationId);
    if (!response.ok) {
      const friendlyMessage = friendlyErrorMessage(response.error || (response.data && response.data.message), 'Nao foi possivel apagar a conversa agora.');
      appendDiagnostic('Falha ao apagar conversa', {
        error: friendlyMessage,
        status: response.status,
        request: response.diagnostics || null
      });
      appendSystem(friendlyMessage);

      if (previousConversationId && !conversations.some(function (item) { return item.conversation_id === previousConversationId; })) {
        await refreshConversations();
        if (previousConversationId) {
          await loadCurrentConversation();
        }
      }
    }
  }

  function appendMessage(role, content, timestamp, payload) {
    const group = document.createElement('article');
    group.className = `message-group ${role}`;
    if (payload && payload.id) {
      group.dataset.messageId = String(payload.id);
    }

    const card = document.createElement('div');
    card.className = 'message-card';

    if (payload && payload.target_message_id) {
      const referenceTag = document.createElement('div');
      referenceTag.className = 'message-reference-tag';
      referenceTag.textContent = payload.action ? `Referencia ${payload.action}` : 'Referencia';
      card.appendChild(referenceTag);
    }

    const contentNode = document.createElement('div');
    contentNode.textContent = content;
    card.appendChild(contentNode);
    group.appendChild(card);

    const metaRow = document.createElement('div');
    metaRow.className = 'message-meta-row';
    const meta = document.createElement('span');
    meta.className = 'message-meta';
    meta.textContent = timestamp ? new Date(timestamp).toLocaleString('pt-BR') : 'Agora';
    metaRow.appendChild(meta);

    if (role === 'assistant' && payload && payload.id) {
      metaRow.appendChild(buildAssistantActionShell(payload));
    }

    group.appendChild(metaRow);
    chatWindow.appendChild(group);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function buildAssistantActionShell(payload) {
    const shell = document.createElement('div');
    shell.className = 'message-actions-shell';

    const referenceButton = document.createElement('button');
    referenceButton.type = 'button';
    referenceButton.className = `message-icon-button ${selectedReference && payload.id === selectedReference.id && !selectedAction ? 'is-active' : ''}`;
    referenceButton.setAttribute('aria-label', 'Referenciar mensagem');
    referenceButton.innerHTML = '&#10551;';
    referenceButton.addEventListener('click', function (event) {
      event.stopPropagation();
      setReferenceFromMessage(payload, null);
      closeActionMenu();
    });

    const menuButton = document.createElement('button');
    shell.appendChild(referenceButton);

    if (isMoreActionsEnabled()) {
      const menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = `message-icon-button message-menu-trigger ${activeActionMenuId === payload.id ? 'is-active' : ''}`;
      menuButton.setAttribute('aria-label', 'Abrir acoes da mensagem');
      menuButton.innerHTML = '&hellip;';
      menuButton.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleActionMenu(payload.id);
      });

      const menu = document.createElement('div');
      menu.className = `message-action-menu ${activeActionMenuId === payload.id ? 'is-open' : ''}`;
      availableActions.forEach(function (action) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `message-action-menu-item ${selectedReference && payload.id === selectedReference.id && selectedAction === action ? 'is-active' : ''}`;
        item.textContent = actionLabel(action);
        item.addEventListener('click', function (event) {
          event.stopPropagation();
          setReferenceFromMessage(payload, action);
          closeActionMenu();
        });
        menu.appendChild(item);
      });

      shell.appendChild(menuButton);
      shell.appendChild(menu);
    }

    return shell;
  }

  function setReferenceFromMessage(payload, action) {
    selectedReference = {
      id: payload.id,
      content: payload.content || ''
    };
    selectedAction = action;
    renderReferenceBanner();
    highlightReference(payload.id);
    updateInputPlaceholder();
    refreshAssistantActionStates();
    chatInput.focus();
  }

  function refreshAssistantActionStates() {
    document.querySelectorAll('.message-actions-shell').forEach(function (shell) {
      const messageId = Number(shell.closest('.message-group')?.dataset.messageId || 0);
      const isMenuOpen = activeActionMenuId === messageId;
      const buttons = shell.querySelectorAll('.message-icon-button');
      const menuButton = shell.querySelector('.message-menu-trigger');
      const menu = shell.querySelector('.message-action-menu');

      shell.classList.toggle('has-open-menu', isMenuOpen);

      if (buttons[0]) {
        buttons[0].classList.toggle('is-active', !!selectedReference && messageId === selectedReference.id && !selectedAction);
      }

      if (menuButton) {
        menuButton.classList.toggle('is-active', isMenuOpen);
      }

      if (menu) {
        menu.classList.toggle('is-open', isMenuOpen);
        menu.querySelectorAll('.message-action-menu-item').forEach(function (item, index) {
          const action = availableActions[index];
          item.classList.toggle('is-active', !!selectedReference && messageId === selectedReference.id && selectedAction === action);
        });
      }
    });
  }

  function toggleActionMenu(messageId) {
    activeActionMenuId = activeActionMenuId === messageId ? null : messageId;
    refreshAssistantActionStates();
  }

  function closeActionMenu() {
    if (activeActionMenuId === null) {
      return;
    }
    activeActionMenuId = null;
    refreshAssistantActionStates();
  }

  function appendTypingIndicator() {
    const group = document.createElement('article');
    group.className = 'message-group assistant typing-indicator';
    group.dataset.pending = 'true';

    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    group.appendChild(card);

    chatWindow.appendChild(group);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return group;
  }

  function removeTypingIndicator() {
    if (pendingReplyNode && pendingReplyNode.parentNode) {
      pendingReplyNode.parentNode.removeChild(pendingReplyNode);
    }
    pendingReplyNode = null;
  }

  function animateAssistantReply(answer) {
    const fullText = String(answer || 'Sem resposta.');
    const host = pendingReplyNode || appendTypingIndicator();
    const card = host.querySelector('.message-card');
    const contentNode = document.createElement('div');
    let index = 0;
    let finished = false;

    host.classList.remove('typing-indicator');
    host.dataset.pending = 'false';
    card.innerHTML = '';
    card.appendChild(contentNode);

    return new Promise(function (resolve) {
      const finish = function () {
        if (finished) {
          return;
        }
        finished = true;
        contentNode.textContent = fullText;
        let metaRow = host.querySelector('.message-meta-row');
        if (!metaRow) {
          metaRow = document.createElement('div');
          metaRow.className = 'message-meta-row';
          const meta = document.createElement('span');
          meta.className = 'message-meta';
          meta.textContent = 'Agora';
          metaRow.appendChild(meta);
          host.appendChild(metaRow);
        }
        pendingReplyNode = null;
        host.removeEventListener('click', finish);
        resolve();
      };

      host.addEventListener('click', finish);

      const tick = function () {
        if (finished) {
          return;
        }
        index += Math.max(1, Math.ceil(fullText.length / 52));
        contentNode.textContent = fullText.slice(0, index);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        if (index >= fullText.length) {
          finish();
          return;
        }
        window.setTimeout(tick, 18);
      };

      window.setTimeout(tick, 120);
    });
  }

  function appendSystem(text) {
    removeWelcomeNote();
    const group = document.createElement('article');
    group.className = 'message-group system';
    const card = document.createElement('div');
    card.className = 'message-card';
    card.textContent = text;
    group.appendChild(card);
    chatWindow.appendChild(group);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function appendWelcomeNote() {
    if (welcomeRendered) {
      return;
    }
    appendSystem(config.welcomeMessage || 'Ola, posso ajudar?');
    const last = chatWindow.lastElementChild;
    if (last) {
      last.dataset.welcome = 'true';
    }
    welcomeRendered = true;
  }

  function removeWelcomeNote() {
    const welcomeNode = chatWindow.querySelector('[data-welcome="true"]');
    if (welcomeNode) {
      welcomeNode.remove();
    }
    welcomeRendered = false;
  }

  function renderReferenceBanner() {
    if (!selectedReference) {
      referenceBanner.classList.add('hidden');
      referenceBanner.innerHTML = '';
      updateInputPlaceholder();
      highlightReference(null);
      refreshAssistantActionStates();
      return;
    }

    referenceBanner.classList.remove('hidden');
    referenceBanner.innerHTML = `
      <div class="reference-banner-head">
        <span class="reference-banner-title">Mensagem referenciada #${escapeHtml(selectedReference.id)}</span>
        <button type="button" class="icon-button" id="clear-reference">Fechar</button>
      </div>
      <div class="reference-banner-copy">${escapeHtml(selectedReference.content).slice(0, 220)}</div>
      <div class="reference-banner-meta">${selectedAction ? `Acao selecionada: ${actionLabel(selectedAction)}` : 'Envie uma pergunta sobre a mensagem referenciada.'}</div>
    `;

    const clearButton = document.getElementById('clear-reference');
    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearReference(true);
      });
    }

    updateInputPlaceholder();
    highlightReference(selectedReference.id);
    refreshAssistantActionStates();
  }

  function clearReference(shouldFocus) {
    selectedReference = null;
    selectedAction = null;
    renderReferenceBanner();
    updateInputPlaceholder();
    if (shouldFocus) {
      chatInput.focus();
    }
  }

  function updateInputPlaceholder() {
    if (selectedReference) {
      chatInput.placeholder = selectedAction
        ? `${actionLabel(selectedAction)} a mensagem referenciada...`
        : 'Escreva sobre a mensagem referenciada...';
    } else {
      chatInput.placeholder = config.placeholder || 'Digite sua pergunta';
    }
  }

  function highlightReference(messageId) {
    document.querySelectorAll('.message-card.selected').forEach(function (node) {
      node.classList.remove('selected');
    });

    if (!messageId) {
      return;
    }

    const selected = document.querySelector(`.message-group[data-message-id="${messageId}"] .message-card`);
    if (selected) {
      selected.classList.add('selected');
    }
  }

  function setRuntimeState(state, label) {
    runtimeBadge.textContent = label;
    runtimeBadge.classList.remove('is-loading', 'is-ready', 'is-error');
    if (state === 'ready') {
      runtimeBadge.classList.add('is-ready');
    } else if (state === 'error') {
      runtimeBadge.classList.add('is-error');
    } else {
      runtimeBadge.classList.add('is-loading');
    }
  }

  function updateConversationBadge() {
    if (!conversationId) {
      conversationBadge.textContent = 'Nova conversa';
      return;
    }

    const current = conversations.find(function (item) {
      return item.conversation_id === conversationId;
    });
    conversationBadge.textContent = current ? buildConversationTitle(current) : `Sessao ${abbreviate(conversationId, 16)}`;
  }

  function setSendingState(active) {
    isSending = active;
    sendButton.disabled = active;
    chatInput.disabled = active;
    sendButton.textContent = active ? 'Enviando...' : 'Enviar';
  }

  function toggleDiagnosticsModal() {
    if (diagnosticsModal.classList.contains('hidden')) {
      diagnosticsModal.classList.remove('hidden');
      diagnosticsModal.setAttribute('aria-hidden', 'false');
    } else {
      hideDiagnosticsModal();
    }
  }

  function hideDiagnosticsModal() {
    diagnosticsModal.classList.add('hidden');
    diagnosticsModal.setAttribute('aria-hidden', 'true');
  }

  function appendDiagnostic(title, payload) {
    const entry = document.createElement('div');
    entry.className = 'diagnostic-entry';

    const heading = document.createElement('strong');
    heading.textContent = title;
    const detail = document.createElement('pre');
    detail.textContent = JSON.stringify(payload, null, 2);

    entry.appendChild(heading);
    entry.appendChild(detail);
    diagnosticPanel.prepend(entry);
  }

  function applyBranding() {
    applyTheme(config.primaryColor || '#c8a64f');

    if (config.chatAppName && brandName) {
      brandName.textContent = config.chatAppName;
      document.title = config.chatAppName;
      if (splashName) {
        splashName.textContent = config.chatAppName;
      }
    }

    if (!config.showPoweredBy && poweredBy) {
      poweredBy.style.display = 'none';
    }

    if (!brandAvatar) {
      return;
    }

    if (config.iconUrl) {
      brandAvatar.innerHTML = `<img src="${config.iconUrl}" alt="Icone do chat" />`;
      if (splashAvatar) {
        splashAvatar.innerHTML = `<img src="${config.iconUrl}" alt="Icone do chat" />`;
      }
      return;
    }

    if (config.logoUrl) {
      brandAvatar.innerHTML = `<img src="${config.logoUrl}" alt="Logo do chat" />`;
      if (splashAvatar) {
        splashAvatar.innerHTML = `<img src="${config.logoUrl}" alt="Logo do chat" />`;
      }
      return;
    }

    brandAvatar.innerHTML = '<span class="brand-avatar-text">K</span>';
    if (splashAvatar) {
      splashAvatar.innerHTML = '<span class="brand-avatar-text">K</span>';
    }
  }

  function applyBootstrapChatAppConfig(chatApp) {
    if (!chatApp || typeof chatApp !== 'object') {
      return;
    }

    if (typeof chatApp.name === 'string' && chatApp.name.trim() !== '') {
      config.chatAppName = chatApp.name.trim();
    }

    if (typeof chatApp.primary_color === 'string' && chatApp.primary_color.trim() !== '') {
      config.primaryColor = chatApp.primary_color.trim();
    }

    if (typeof chatApp.icon_url === 'string' || chatApp.icon_url === null) {
      config.iconUrl = chatApp.icon_url;
    }

    if (typeof chatApp.logo_url === 'string' || chatApp.logo_url === null) {
      config.logoUrl = chatApp.logo_url;
    }

    if (typeof chatApp.placeholder === 'string' && chatApp.placeholder.trim() !== '') {
      config.placeholder = chatApp.placeholder.trim();
    }

    if (typeof chatApp.welcome_message === 'string' && chatApp.welcome_message.trim() !== '') {
      config.welcomeMessage = chatApp.welcome_message.trim();
    }

    if (typeof chatApp.show_powered_by === 'boolean') {
      config.showPoweredBy = chatApp.show_powered_by;
    }

    if (chatApp.settings && typeof chatApp.settings === 'object') {
      config.settings = chatApp.settings;
    }

    applyBranding();
    updateInputPlaceholder();
  }

  function finishInitialLoading() {
    body.classList.remove('is-loading');
    if (api.notifyRendererReady) {
      api.notifyRendererReady();
    }
  }

  function applyStoredInstallationState() {
    if (!installationId || !persistedStore.installations || !persistedStore.installations[String(installationId)]) {
      return;
    }

    const stored = persistedStore.installations[String(installationId)];
    conversationId = stored.activeConversationId || conversationId;
    conversations = Array.isArray(stored.conversations) ? stored.conversations : conversations;

    const persistedHistory = stored.history && typeof stored.history === 'object' ? stored.history : {};
    Object.keys(persistedHistory).forEach(function (key) {
      const entry = persistedHistory[key];
      if (!entry || !Array.isArray(entry.messages)) {
        return;
      }

      historyCache.set(key, {
        messages: entry.messages,
        firstUserMessage: entry.firstUserMessage || findFirstUserMessage(entry.messages),
        updatedAt: entry.updatedAt || null,
        fetchedAt: entry.fetchedAt || Date.now()
      });
    });
  }

  function isMoreActionsEnabled() {
    return !(config.settings && config.settings.enable_more_actions === false);
  }

  function applyTheme(color) {
    const theme = deriveTheme(color);
    root.style.setProperty('--primary-color', theme.primary);
    root.style.setProperty('--primary-light', theme.light);
    root.style.setProperty('--primary-dark', theme.dark);
    root.style.setProperty('--accent-color', theme.soft);
    root.style.setProperty('--accent-border', theme.border);
  }

  function deriveTheme(input) {
    const normalized = normalizeHexColor(input);
    const hsl = hexToHsl(normalized);
    return {
      primary: normalized,
      light: hslToHex(hsl.h, clamp(hsl.s, 52, 88), clamp(hsl.l + 16, 44, 76)),
      dark: hslToHex(hsl.h, clamp(hsl.s, 44, 86), clamp(hsl.l - 22, 18, 48)),
      soft: `hsla(${hsl.h}, ${Math.round(clamp(hsl.s, 44, 88))}%, ${Math.round(clamp(hsl.l, 34, 62))}%, 0.16)`,
      border: `hsla(${hsl.h}, ${Math.round(clamp(hsl.s, 44, 88))}%, ${Math.round(clamp(hsl.l + 4, 38, 68))}%, 0.32)`
    };
  }

  function buildConversationTitle(item) {
    const raw = item && item.title ? String(item.title).trim() : '';
    return abbreviate(raw || 'Conversa sem titulo', 38);
  }

  function buildConversationPreview(item) {
    const cached = historyCache.get(item.conversation_id);
    const preview = cached && cached.firstUserMessage ? cached.firstUserMessage : '';
    return preview ? abbreviate(preview, 58) : '';
  }

  function findFirstUserMessage(messages) {
    const userMessage = (messages || []).find(function (message) {
      return message.role === 'user' && message.content;
    });
    return userMessage ? String(userMessage.content).trim() : '';
  }

  function actionLabel(action) {
    switch (action) {
      case 'improve': return 'Melhorar';
      case 'rewrite': return 'Reescrever';
      case 'summarize': return 'Resumir';
      case 'expand': return 'Expandir';
      case 'shorten': return 'Encurtar';
      default: return 'Referenciar';
    }
  }

  function abbreviate(value, length) {
    const text = String(value || '');
    if (text.length <= length) {
      return text;
    }
    return `${text.slice(0, Math.max(6, length - 3))}...`;
  }

  function normalizeHexColor(value) {
    const source = String(value || '').trim().replace('#', '');
    if (/^[0-9a-fA-F]{3}$/.test(source)) {
      return `#${source.split('').map(function (char) { return char + char; }).join('').toLowerCase()}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(source)) {
      return `#${source.toLowerCase()}`;
    }
    return '#c8a64f';
  }

  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        default:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: Math.round(h * 360), s: s * 100, l: l * 100 };
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex).replace('#', '');
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    const sat = clamp(s, 0, 100) / 100;
    const light = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = light - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (hue < 60) {
      r = c; g = x; b = 0;
    } else if (hue < 120) {
      r = x; g = c; b = 0;
    } else if (hue < 180) {
      r = 0; g = c; b = x;
    } else if (hue < 240) {
      r = 0; g = x; b = c;
    } else if (hue < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    return rgbToHex(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    );
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(function (value) {
      return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
    }).join('')}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function friendlyErrorMessage(rawMessage, fallbackMessage) {
    const message = String(rawMessage || '').toLowerCase();

    if (message.includes('limite') || message.includes('token') || message.includes('limit reached')) {
      return 'O seu plano atingiu o limite de uso neste mes.\n\nPara continuar utilizando o sistema, entre em contato com o responsavel ou suporte.';
    }

    if (message.includes('failed to fetch') || message.includes('network') || message.includes('conexao')) {
      return 'Nao foi possivel se comunicar com o servidor agora. Verifique sua conexao e tente novamente.';
    }

    if (message.includes('inactive') || message.includes('indisponivel')) {
      return 'Este ambiente nao esta disponivel no momento. Tente novamente mais tarde.';
    }

    if (message.includes('not found')) {
      return 'Nao foi possivel localizar os dados solicitados no momento.';
    }

    return fallbackMessage || 'Ocorreu uma instabilidade temporaria. Tente novamente em instantes.';
  }

  async function hydratePersistedState() {
    if (!api.storageLoad) {
      return;
    }

    const state = await api.storageLoad();
    persistedStore = state && typeof state === 'object' ? state : {};
    if (!persistedStore || typeof persistedStore !== 'object') {
      return;
    }

    installationKey = persistedStore.installationKey || installationKey;
    installationId = persistedStore.installationId || installationId;
    conversationId = persistedStore.activeConversationId || conversationId;
    conversations = Array.isArray(persistedStore.conversations) ? persistedStore.conversations : conversations;

    const persistedHistory = persistedStore.history && typeof persistedStore.history === 'object' ? persistedStore.history : {};
    Object.keys(persistedHistory).forEach(function (key) {
      const entry = persistedHistory[key];
      if (!entry || !Array.isArray(entry.messages)) {
        return;
      }

      historyCache.set(key, {
        messages: entry.messages,
        firstUserMessage: entry.firstUserMessage || findFirstUserMessage(entry.messages),
        updatedAt: entry.updatedAt || null,
        fetchedAt: entry.fetchedAt || Date.now()
      });
    });
  }

  function persistState() {
    if (!api.storageSave) {
      return;
    }

    const history = {};
    historyCache.forEach(function (entry, key) {
      history[key] = {
        messages: entry.messages || [],
        firstUserMessage: entry.firstUserMessage || null,
        updatedAt: entry.updatedAt || null,
        fetchedAt: entry.fetchedAt || Date.now()
      };
    });

    const installationState = {
      activeConversationId: conversationId,
      conversations: conversations,
      history: history,
      savedAt: new Date().toISOString()
    };

    persistedStore = {
      bindingCode: bindingCode,
      installationId: installationId,
      installationKey: installationKey,
      activeConversationId: installationState.activeConversationId,
      conversations: installationState.conversations,
      history: installationState.history,
      installations: Object.assign({}, persistedStore.installations || {}, installationId ? { [String(installationId)]: installationState } : {}),
      savedAt: installationState.savedAt
    };

    api.storageSave(persistedStore).catch(function () {
      appendDiagnostic('Falha ao salvar cache local', {
        installationId: installationId,
        activeConversationId: conversationId
      });
    });
  }

  function persistConversationId() {
    persistState();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
