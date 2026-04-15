export const AVAILABLE_ACTIONS = ['improve', 'rewrite', 'summarize', 'expand', 'shorten'];

export function actionLabel(action) {
  return {
    improve: 'Melhorar',
    rewrite: 'Reescrever',
    summarize: 'Resumir',
    expand: 'Expandir',
    shorten: 'Encurtar',
  }[action] || action;
}

export function friendlyErrorMessage(rawMessage, fallbackMessage = 'Ocorreu uma instabilidade temporaria. Tente novamente em instantes.') {
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

  return fallbackMessage;
}

export function buildConversationTitle(item) {
  const base = (item?.title || item?.firstUserMessage || item?.first_user_message || 'Nova conversa').trim();
  return abbreviate(base, 38);
}

export function buildConversationPreview(item) {
  return abbreviate(item?.firstUserMessage || item?.first_user_message || '', 72);
}

export function abbreviate(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function findFirstUserMessage(messages) {
  return (messages || []).find((message) => message?.role === 'user')?.content || null;
}
