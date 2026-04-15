import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AVAILABLE_ACTIONS, actionLabel, buildConversationPreview, buildConversationTitle, findFirstUserMessage, friendlyErrorMessage } from '../services/messages';
import { checkAndApplyShellUpdate, isTauriRuntime } from '../services/runtime';
import { applyTheme } from '../services/theme';

const runtimeConfig = window.KRYON_DESKTOP_CONFIG || {};
const desktopApi = window.KRYON_DESKTOP_API;
const diagnosticsBootstrap = window.KRYON_DESKTOP_DIAGNOSTICS || {};

function buildSystemMessage(content) {
  return {
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'system',
    content,
    created_at: new Date().toISOString(),
  };
}

function buildAssistantTypingMessage() {
  return {
    id: `assistant-typing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: '',
    created_at: new Date().toISOString(),
    isThinking: true,
    isTyping: true,
  };
}

function buildReferenceLabel(messages, messageId) {
  const messageIndex = (messages || []).findIndex((entry) => entry?.id === messageId);
  if (messageIndex === -1) {
    return 'Mensagem referenciada';
  }

  const visibleIndex = (messages || [])
    .slice(0, messageIndex + 1)
    .filter((entry) => entry?.role === 'assistant' || entry?.role === 'user')
    .length;

  return visibleIndex > 0 ? `Mensagem referenciada #${visibleIndex}` : 'Mensagem referenciada';
}

function buildUserMessage(content) {
  return {
    id: `user-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'user',
    content,
    created_at: new Date().toISOString(),
  };
}

export function useDesktopChat() {
  const [config, setConfig] = useState(runtimeConfig);
  const [runtimeState, setRuntimeState] = useState({ status: 'loading', label: 'Conectando' });
  const [diagnostics, setDiagnostics] = useState([
    {
      title: 'Inicializacao',
      payload: {
        apiBaseUrl: diagnosticsBootstrap.environment?.apiBaseUrl || null,
        bindingCode: diagnosticsBootstrap.environment?.bindingCode || null,
        preloadError: diagnosticsBootstrap.preloadError || null,
      },
    },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedReference, setSelectedReference] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [draftVisible, setDraftVisible] = useState(false);
  const [confirmDeleteConversationId, setConfirmDeleteConversationId] = useState(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const historyCacheRef = useRef(new Map());
  const prefetchedRef = useRef(new Set());
  const persistedStoreRef = useRef({});
  const sessionTokenRef = useRef(null);
  const installationIdRef = useRef(null);
  const installationKeyRef = useRef(null);

  const moreActionsEnabled = !(config.settings && config.settings.enable_more_actions === false);
  const welcomeMessage = config.welcomeMessage || 'Ola, posso ajudar?';
  const runtimeMachineLabel = config.runtimeMachineLabel || 'desktop-electron';
  const runtimePlatform = config.runtimePlatform || 'windows-electron';
  const runtimeVersion = config.runtimeVersion || '1.0.0';
  const placeholder = selectedReference
    ? 'Escreva sobre a mensagem referenciada...'
    : (config.placeholder || 'Digite sua pergunta');

  const activeConversation = useMemo(
    () => conversations.find((item) => item.conversation_id === activeConversationId) || null,
    [conversations, activeConversationId],
  );

  const filteredConversations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return conversations;
    }

    return conversations.filter((item) => {
      const title = buildConversationTitle(item).toLowerCase();
      const preview = buildConversationPreview(item).toLowerCase();
      return title.includes(term) || preview.includes(term);
    });
  }, [conversations, searchTerm]);

  const persistState = useCallback(() => {
    if (!desktopApi?.storageSave) {
      return;
    }

    const history = {};
    historyCacheRef.current.forEach((entry, key) => {
      history[key] = {
        messages: entry.messages || [],
        firstUserMessage: entry.firstUserMessage || null,
        updatedAt: entry.updatedAt || null,
        fetchedAt: entry.fetchedAt || Date.now(),
      };
    });

    const installationId = installationIdRef.current;
    const installationKey = installationKeyRef.current;
    const installationState = {
      activeConversationId,
      conversations,
      history,
      savedAt: new Date().toISOString(),
    };

    persistedStoreRef.current = {
      ...persistedStoreRef.current,
      bindingCode: config.bindingCode || null,
      installationId,
      installationKey,
      activeConversationId,
      conversations,
      history,
      installations: {
        ...(persistedStoreRef.current.installations || {}),
        ...(installationId ? { [String(installationId)]: installationState } : {}),
      },
      savedAt: installationState.savedAt,
    };

    desktopApi.storageSave(persistedStoreRef.current).catch(() => {
      setDiagnostics((current) => [
        {
          title: 'Falha ao salvar cache local',
          payload: {
            installationId,
            activeConversationId,
          },
        },
        ...current,
      ]);
    });
  }, [activeConversationId, config.bindingCode, conversations]);

  const appendDiagnostic = useCallback((title, payload) => {
    setDiagnostics((current) => [{ title, payload }, ...current]);
  }, []);

  const appendSystemMessage = useCallback((content) => {
    setMessages((current) => [...current, buildSystemMessage(content)]);
  }, []);

  const finishInitialLoading = useCallback(() => {
    setIsInitialLoading(false);
    if (desktopApi?.notifyRendererReady) {
      desktopApi.notifyRendererReady();
    }
  }, []);

  const hydratePersistedState = useCallback(async () => {
    if (!desktopApi?.storageLoad) {
      return;
    }

    const state = await desktopApi.storageLoad();
    persistedStoreRef.current = state && typeof state === 'object' ? state : {};
    const persisted = persistedStoreRef.current;

    installationKeyRef.current = persisted.installationKey || null;
    installationIdRef.current = persisted.installationId || null;
    setActiveConversationId(persisted.activeConversationId || null);
    setConversations(Array.isArray(persisted.conversations) ? persisted.conversations : []);

    const persistedHistory = persisted.history && typeof persisted.history === 'object' ? persisted.history : {};
    Object.entries(persistedHistory).forEach(([key, entry]) => {
      if (!entry || !Array.isArray(entry.messages)) {
        return;
      }

      historyCacheRef.current.set(key, {
        messages: entry.messages,
        firstUserMessage: entry.firstUserMessage || findFirstUserMessage(entry.messages),
        updatedAt: entry.updatedAt || null,
        fetchedAt: entry.fetchedAt || Date.now(),
      });
    });

    return {
      activeConversationId: persisted.activeConversationId || null,
      conversations: Array.isArray(persisted.conversations) ? persisted.conversations : [],
    };
  }, []);

  const applyStoredInstallationState = useCallback(() => {
    const installationId = installationIdRef.current;
    const persisted = persistedStoreRef.current;
    const stored = installationId && persisted.installations ? persisted.installations[String(installationId)] : null;

    if (!stored) {
      return;
    }

    setActiveConversationId(stored.activeConversationId || null);
    setConversations(Array.isArray(stored.conversations) ? stored.conversations : []);

    Object.entries(stored.history || {}).forEach(([key, entry]) => {
      if (!entry || !Array.isArray(entry.messages)) {
        return;
      }

      historyCacheRef.current.set(key, {
        messages: entry.messages,
        firstUserMessage: entry.firstUserMessage || findFirstUserMessage(entry.messages),
        updatedAt: entry.updatedAt || null,
        fetchedAt: entry.fetchedAt || Date.now(),
      });
    });
  }, []);

  const applyBootstrapConfig = useCallback((chatApp) => {
    if (!chatApp || typeof chatApp !== 'object') {
      return;
    }

    setConfig((current) => {
      const next = { ...current };
      if (typeof chatApp.name === 'string' && chatApp.name.trim()) next.chatAppName = chatApp.name.trim();
      if (typeof chatApp.primary_color === 'string' && chatApp.primary_color.trim()) next.primaryColor = chatApp.primary_color.trim();
      if (typeof chatApp.icon_url === 'string' || chatApp.icon_url === null) next.iconUrl = chatApp.icon_url;
      if (typeof chatApp.logo_url === 'string' || chatApp.logo_url === null) next.logoUrl = chatApp.logo_url;
      if (typeof chatApp.placeholder === 'string' && chatApp.placeholder.trim()) next.placeholder = chatApp.placeholder.trim();
      if (typeof chatApp.welcome_message === 'string' && chatApp.welcome_message.trim()) next.welcomeMessage = chatApp.welcome_message.trim();
      if (typeof chatApp.show_powered_by === 'boolean') next.showPoweredBy = chatApp.show_powered_by;
      if (chatApp.settings && typeof chatApp.settings === 'object') next.settings = chatApp.settings;
      return next;
    });
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!sessionTokenRef.current) {
      return;
    }

    const response = await desktopApi.listConversations(sessionTokenRef.current);
    const data = response.data || {};

    if (!response.ok) {
      appendDiagnostic('Falha ao listar conversas', {
        error: friendlyErrorMessage(response.error || data.message, 'Nao foi possivel atualizar o historico agora.'),
        status: response.status,
        request: response.diagnostics || null,
      });
      return;
    }

    setConversations((Array.isArray(data.items) ? data.items : []).map((item) => {
      const cacheEntry = historyCacheRef.current.get(item.conversation_id);
      return {
        ...item,
        firstUserMessage: item.firstUserMessage || item.first_user_message || cacheEntry?.firstUserMessage || null,
      };
    }));
  }, [appendDiagnostic]);

  const renderCachedConversation = useCallback((conversationId) => {
    const cached = historyCacheRef.current.get(conversationId);
    if (!cached) {
      return false;
    }

    setMessages(cached.messages || []);
    return true;
  }, []);

  const fetchConversationHistory = useCallback(async (conversationId, repaint = true) => {
    if (!sessionTokenRef.current || !conversationId) {
      return;
    }

    const response = await desktopApi.conversationHistory(sessionTokenRef.current, conversationId);
    const data = response.data || {};

    if (!response.ok) {
      appendDiagnostic('Falha ao carregar historico', {
        error: friendlyErrorMessage(response.error || data.message, 'Nao foi possivel carregar essa conversa agora.'),
        status: response.status,
        request: response.diagnostics || null,
      });
      return;
    }

    const nextMessages = Array.isArray(data.messages) ? data.messages : [];
    historyCacheRef.current.set(conversationId, {
      messages: nextMessages,
      firstUserMessage: findFirstUserMessage(nextMessages),
      updatedAt: data.updated_at || null,
      fetchedAt: Date.now(),
    });

    setConversations((current) => current.map((item) => (
      item.conversation_id === conversationId
        ? { ...item, firstUserMessage: findFirstUserMessage(nextMessages) || item.firstUserMessage || item.title }
        : item
    )));

    if (repaint && activeConversationId === conversationId) {
      setMessages(nextMessages);
    }

    persistState();
  }, [activeConversationId, appendDiagnostic, persistState]);

  const loadConversation = useCallback(async (conversationId, options = {}) => {
    if (!conversationId) {
      return;
    }

    const preferCache = options.preferCache !== false;
    const silentBackgroundRefresh = options.silentBackgroundRefresh === true;

    setActiveConversationId(conversationId);
    setDraftVisible(false);

    const painted = preferCache ? renderCachedConversation(conversationId) : false;
    if (painted && silentBackgroundRefresh) {
      fetchConversationHistory(conversationId, false);
      return;
    }

    if (!painted) {
      setMessages([]);
    }

    await fetchConversationHistory(conversationId, true);
  }, [fetchConversationHistory, renderCachedConversation]);

  const preloadRecentConversations = useCallback(() => {
    conversations.slice(0, 10).forEach((item) => {
      const conversationId = item?.conversation_id;
      if (!conversationId || historyCacheRef.current.has(conversationId) || prefetchedRef.current.has(conversationId)) {
        return;
      }

      prefetchedRef.current.add(conversationId);
      fetchConversationHistory(conversationId, false)
        .finally(() => prefetchedRef.current.delete(conversationId));
    });
  }, [conversations, fetchConversationHistory]);

  const clearReference = useCallback(() => {
    setSelectedReference(null);
    setSelectedAction(null);
  }, []);

  const typeAssistantReply = useCallback((text, targetMessageId = null) => new Promise((resolve) => {
    const fullText = String(text || 'Sem resposta.');
    const typingMessage = targetMessageId ? {
      id: targetMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isThinking: true,
      isTyping: true,
    } : buildAssistantTypingMessage();

    if (!targetMessageId) {
      setMessages((current) => [...current, typingMessage]);
    }

    let index = 0;
    let stopped = false;
    const step = fullText.length > 720
      ? 10
      : fullText.length > 420
        ? 7
        : fullText.length > 180
          ? 4
          : 2;

    const finish = () => {
      if (stopped) {
        return;
      }

      stopped = true;
      setMessages((current) => current.map((message) => (
        message.id === typingMessage.id
          ? { ...message, content: fullText, isThinking: false, isTyping: false, created_at: new Date().toISOString() }
          : message
      )));
      resolve();
    };

    const tick = () => {
      if (stopped) {
        return;
      }

      index += step;
      const partial = fullText.slice(0, index);
      setMessages((current) => current.map((message) => (
        message.id === typingMessage.id
          ? { ...message, content: partial, isThinking: false, isTyping: index < fullText.length, created_at: new Date().toISOString() }
          : message
      )));

      if (index >= fullText.length) {
        finish();
        return;
      }

      window.setTimeout(tick, 18);
    };

    window.setTimeout(tick, 180);
  }), []);

  const askQuestion = useCallback(async (question) => {
    const trimmed = String(question || '').trim();
    if (!trimmed || !sessionTokenRef.current || isSending) {
      return;
    }

    setIsSending(true);
    const pendingAssistantMessage = buildAssistantTypingMessage();
    setMessages((current) => [
      ...current.filter((item) => !item.isWelcome),
      buildUserMessage(trimmed),
      pendingAssistantMessage,
    ]);
    setDraftVisible(false);

    try {
      const response = await desktopApi.ask(sessionTokenRef.current, {
        question: trimmed,
        conversation_id: activeConversationId || undefined,
        target_message_id: selectedReference ? selectedReference.id : undefined,
        action: selectedAction || undefined,
      });
      const data = response.data || {};

      if (!response.ok) {
        const friendlyMessage = friendlyErrorMessage(response.error || data.message, 'Nao foi possivel enviar sua mensagem agora.');
        appendDiagnostic('Falha no envio', {
          error: friendlyMessage,
          status: response.status,
          request: response.diagnostics || null,
        });
        throw new Error(friendlyMessage);
      }

      const nextConversationId = data.conversation_id || activeConversationId;
      if (nextConversationId) {
        setActiveConversationId(nextConversationId);
      }

      await typeAssistantReply(data.answer || 'Sem resposta.', pendingAssistantMessage.id);
      await refreshConversations();
      if (nextConversationId) {
        await fetchConversationHistory(nextConversationId, true);
      }
      clearReference();
    } catch (error) {
      setMessages((current) => current.filter((item) => item.id !== pendingAssistantMessage.id));
      appendSystemMessage(friendlyErrorMessage(error?.message, 'Nao foi possivel enviar sua mensagem agora.'));
    } finally {
      setIsSending(false);
    }
  }, [activeConversationId, appendDiagnostic, appendSystemMessage, clearReference, fetchConversationHistory, isSending, refreshConversations, selectedAction, selectedReference, typeAssistantReply]);

  const bootstrap = useCallback(async () => {
    if (!desktopApi || typeof desktopApi.bootstrap !== 'function') {
      setRuntimeState({ status: 'error', label: 'Falha de inicializacao' });
      appendSystemMessage('Nao foi possivel iniciar o aplicativo agora. Feche e tente novamente em instantes.');
      finishInitialLoading();
      return;
    }

    const response = await desktopApi.bootstrap({
      binding_code: config.bindingCode || null,
      installation_key: installationKeyRef.current,
      machine_label: runtimeMachineLabel,
      platform: runtimePlatform,
      app_version: runtimeVersion,
      metadata: { user_agent: navigator.userAgent },
    });

    const data = response.data || {};
    if (!response.ok) {
      const friendlyMessage = friendlyErrorMessage(response.error || data.message, 'Nao foi possivel carregar o sistema agora. Tente novamente em instantes.');
      appendDiagnostic('Falha no bootstrap', {
        error: friendlyMessage,
        status: response.status,
        request: response.diagnostics || null,
      });
      throw new Error(friendlyMessage);
    }

    sessionTokenRef.current = data.session_token;
    installationKeyRef.current = data.installation?.installation_key || installationKeyRef.current;
    installationIdRef.current = data.installation?.id || installationIdRef.current;
    applyStoredInstallationState();
    applyBootstrapConfig(data.chat_app || null);
    persistState();

    appendDiagnostic('Bootstrap OK', {
      installationId: installationIdRef.current,
      installationKey: installationKeyRef.current,
      sessionExpiresAt: data.installation?.session_expires_at || null,
    });
  }, [appendDiagnostic, appendSystemMessage, applyBootstrapConfig, applyStoredInstallationState, config.bindingCode, finishInitialLoading, persistState, runtimeMachineLabel, runtimePlatform, runtimeVersion]);

  const startNewConversation = useCallback(() => {
    setDraftVisible(true);
    setActiveConversationId(null);
    setMessages([buildSystemMessage(welcomeMessage)]);
    clearReference();
  }, [clearReference, welcomeMessage]);

  const requestDeleteConversation = useCallback((conversationId) => {
    setConfirmDeleteConversationId(conversationId);
  }, []);

  const cancelDeleteConversation = useCallback(() => {
    setConfirmDeleteConversationId(null);
  }, []);

  const confirmDeleteConversation = useCallback(async () => {
    if (!confirmDeleteConversationId || !sessionTokenRef.current) {
      setConfirmDeleteConversationId(null);
      return;
    }

    const target = confirmDeleteConversationId;
    setConfirmDeleteConversationId(null);

    const fallbackConversation = conversations.find((item) => item.conversation_id !== target);
    setConversations((current) => current.filter((item) => item.conversation_id !== target));
    historyCacheRef.current.delete(target);
    prefetchedRef.current.delete(target);

    if (activeConversationId === target) {
      const nextId = fallbackConversation?.conversation_id || null;
      setActiveConversationId(nextId);
      if (nextId && historyCacheRef.current.has(nextId)) {
        setMessages(historyCacheRef.current.get(nextId).messages || []);
      } else {
        setMessages([buildSystemMessage(welcomeMessage)]);
      }
    }

    persistState();

    const response = await desktopApi.archiveConversation(sessionTokenRef.current, target);
    if (!response.ok) {
      const friendlyMessage = friendlyErrorMessage(response.error || response.data?.message, 'Nao foi possivel apagar a conversa agora.');
      appendDiagnostic('Falha ao apagar conversa', {
        error: friendlyMessage,
        status: response.status,
        request: response.diagnostics || null,
      });
      appendSystemMessage(friendlyMessage);
      await refreshConversations();
    }
  }, [activeConversationId, appendDiagnostic, appendSystemMessage, confirmDeleteConversationId, conversations, persistState, refreshConversations, welcomeMessage]);

  useEffect(() => {
    applyTheme(config.primaryColor || '#c8a64f');
    if (config.chatAppName) {
      document.title = config.chatAppName;
    }
  }, [config.chatAppName, config.primaryColor]);

  useEffect(() => {
    let active = true;

    if (!isTauriRuntime()) {
      return () => {
        active = false;
      };
    }

    checkAndApplyShellUpdate((event) => {
      if (!active || !event) {
        return;
      }

      if (event.phase === 'available') {
        setRuntimeState({ status: 'loading', label: 'Atualizando app' });
        appendDiagnostic('Atualizacao encontrada', {
          version: event.version || null,
          date: event.date || null,
        });
        return;
      }

      if (event.event === 'Started') {
        setRuntimeState({ status: 'loading', label: 'Baixando atualizacao' });
        return;
      }

      if (event.event === 'Finished') {
        setRuntimeState({ status: 'loading', label: 'Aplicando atualizacao' });
      }
    }).then((result) => {
      if (!active || !result?.error) {
        return;
      }

      appendDiagnostic('Falha ao verificar atualizacao', {
        error: result.error,
      });
    });

    return () => {
      active = false;
    };
  }, [appendDiagnostic]);

  useEffect(() => {
    let mounted = true;

    hydratePersistedState()
      .then(async (hydrated) => {
        if (!mounted) return;

        if (hydrated?.activeConversationId && historyCacheRef.current.has(hydrated.activeConversationId)) {
          setMessages(historyCacheRef.current.get(hydrated.activeConversationId).messages || []);
        }

        await bootstrap();
        if (!mounted) return;

        await refreshConversations();
        if (!mounted) return;

        if (hydrated?.activeConversationId) {
          await loadConversation(hydrated.activeConversationId, { preferCache: true, silentBackgroundRefresh: true });
        } else if ((hydrated?.conversations || []).length === 0) {
          setDraftVisible(true);
          setMessages([buildSystemMessage(welcomeMessage)]);
        }

        preloadRecentConversations();
        setRuntimeState({ status: 'ready', label: 'Pronto' });
        finishInitialLoading();
      })
      .catch((error) => {
        if (!mounted) return;
        setRuntimeState({ status: 'error', label: 'Erro de conexao' });
        appendSystemMessage(friendlyErrorMessage(error?.message, 'Nao foi possivel carregar o sistema agora. Tente novamente em instantes.'));
        finishInitialLoading();
      });

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    persistState();
  }, [activeConversationId, conversations, messages, persistState]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setDiagnosticsOpen((current) => !current);
      }

      if (event.key === 'Escape') {
        setDiagnosticsOpen(false);
        setConfirmDeleteConversationId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const visibleMessages = messages.length > 0 ? messages : [buildSystemMessage(welcomeMessage)];

  return {
    state: {
      config,
      runtimeState,
      diagnostics,
      diagnosticsOpen,
      filteredConversations,
      conversations,
      activeConversation,
      activeConversationId,
      messages: visibleMessages,
      isInitialLoading,
      isSending,
      selectedReference,
      selectedAction,
      draftVisible,
      searchTerm,
      confirmDeleteConversationId,
      placeholder,
      moreActionsEnabled,
      availableActions: AVAILABLE_ACTIONS,
    },
    actions: {
      setSearchTerm,
      startNewConversation,
      loadConversation,
      askQuestion,
      setReference: (message, action = null) => {
        setSelectedReference(message ? {
          id: message.id,
          content: message.content || '',
          label: buildReferenceLabel(messages, message.id),
        } : null);
        setSelectedAction(action);
      },
      clearReference,
      requestDeleteConversation,
      cancelDeleteConversation,
      confirmDeleteConversation,
      setDiagnosticsOpen,
      actionLabel,
    },
  };
}
