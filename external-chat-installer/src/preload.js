const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

let config = {};
let preloadError = null;

try {
  const rawArg = process.argv.find((arg) => arg.startsWith('--kryon-config='));
  if (!rawArg) {
    throw new Error('argumento --kryon-config ausente');
  }

  config = JSON.parse(decodeURIComponent(rawArg.slice('--kryon-config='.length)));
} catch (error) {
  preloadError = `Falha ao carregar configuracao: ${error.message}`;
}

async function request(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data,
      diagnostics: {
        url,
        method: options.method || 'GET'
      }
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {},
      error: error instanceof Error ? error.message : String(error),
      diagnostics: {
        url,
        method: options.method || 'GET'
      }
    };
  }
}

function apiUrl(path) {
  return `${String(config.apiBaseUrl || '').replace(/\/$/, '')}${path}`;
}

function authHeaders(sessionToken, withJsonBody = false) {
  const headers = {
    'Authorization': `Bearer ${sessionToken}`,
    'Accept': 'application/json'
  };

  if (withJsonBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function storageFilePath() {
  const rootDir = process.env.APPDATA || os.homedir();
  const baseDir = path.join(rootDir, 'chat-desktop-runtime');
  const bindingCode = String(config.bindingCode || 'default').trim() || 'default';
  return path.join(baseDir, `${bindingCode}.json`);
}

function loadStorageState() {
  try {
    const filePath = storageFilePath();
    if (!fs.existsSync(filePath)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return {};
  }
}

function saveStorageState(payload) {
  const filePath = storageFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, filePath };
}

const api = {
  bootstrap: async function (payload) {
    return request(apiUrl('/api/external-chat/bootstrap'), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  },
  listConversations: async function (sessionToken) {
    return request(apiUrl('/api/external-chat/conversations'), {
      headers: authHeaders(sessionToken)
    });
  },
  ask: async function (sessionToken, payload) {
    return request(apiUrl('/api/external-chat/ask'), {
      method: 'POST',
      headers: authHeaders(sessionToken, true),
      body: JSON.stringify(payload)
    });
  },
  conversationHistory: async function (sessionToken, conversationId) {
    return request(apiUrl(`/api/external-chat/conversations/${conversationId}/messages`), {
      headers: authHeaders(sessionToken)
    });
  },
  archiveConversation: async function (sessionToken, conversationId) {
    return request(apiUrl(`/api/external-chat/conversations/${conversationId}/archive`), {
      method: 'PATCH',
      headers: authHeaders(sessionToken)
    });
  },
  storageLoad: async function () {
    return loadStorageState();
  },
  storageSave: async function (payload) {
    return saveStorageState(payload);
  },
  notifyRendererReady: function () {
    ipcRenderer.send('kryon-renderer-ready');
  }
};

contextBridge.exposeInMainWorld('KRYON_DESKTOP_CONFIG', config);
contextBridge.exposeInMainWorld('KRYON_DESKTOP_API', api);
contextBridge.exposeInMainWorld('KRYON_DESKTOP_DIAGNOSTICS', {
  preloadError,
  environment: {
    apiBaseUrl: config.apiBaseUrl || null,
    bindingCode: config.bindingCode || null
  }
});
