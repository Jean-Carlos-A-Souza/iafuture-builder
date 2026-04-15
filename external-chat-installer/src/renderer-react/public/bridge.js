(function () {
  if (window.KRYON_DESKTOP_API) {
    return;
  }

  var config = window.KRYON_DESKTOP_CONFIG || {};
  var storageKey = 'kryon-chat-runtime:' + String(config.bindingCode || 'default').trim();

  function apiUrl(route) {
    return String(config.apiBaseUrl || '').replace(/\/$/, '') + route;
  }

  function authHeaders(sessionToken, withJsonBody) {
    var headers = {
      Accept: 'application/json',
      Authorization: 'Bearer ' + sessionToken,
    };

    if (withJsonBody) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  function request(url, options) {
    var requestOptions = options || {};

    return fetch(url, requestOptions)
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return {
            ok: response.ok,
            status: response.status,
            data: data,
            diagnostics: {
              url: url,
              method: requestOptions.method || 'GET',
            },
          };
        });
      })
      .catch(function (error) {
        return {
          ok: false,
          status: 0,
          data: {},
          error: error instanceof Error ? error.message : String(error),
          diagnostics: {
            url: url,
            method: requestOptions.method || 'GET',
          },
        };
      });
  }

  function storageLoad() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      return Promise.resolve(raw ? JSON.parse(raw) : {});
    } catch (_error) {
      return Promise.resolve({});
    }
  }

  function storageSave(payload) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload || {}));
      return Promise.resolve({ ok: true });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  window.KRYON_DESKTOP_DIAGNOSTICS = window.KRYON_DESKTOP_DIAGNOSTICS || {
    preloadError: null,
    environment: {
      apiBaseUrl: config.apiBaseUrl || null,
      bindingCode: config.bindingCode || null,
    },
  };

  window.KRYON_DESKTOP_API = {
    bootstrap: function (payload) {
      return request(apiUrl('/api/external-chat/bootstrap'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    },
    listConversations: function (sessionToken) {
      return request(apiUrl('/api/external-chat/conversations'), {
        headers: authHeaders(sessionToken, false),
      });
    },
    ask: function (sessionToken, payload) {
      return request(apiUrl('/api/external-chat/ask'), {
        method: 'POST',
        headers: authHeaders(sessionToken, true),
        body: JSON.stringify(payload),
      });
    },
    conversationHistory: function (sessionToken, conversationId) {
      return request(apiUrl('/api/external-chat/conversations/' + conversationId + '/messages'), {
        headers: authHeaders(sessionToken, false),
      });
    },
    archiveConversation: function (sessionToken, conversationId) {
      return request(apiUrl('/api/external-chat/conversations/' + conversationId + '/archive'), {
        method: 'PATCH',
        headers: authHeaders(sessionToken, false),
      });
    },
    storageLoad: storageLoad,
    storageSave: storageSave,
    notifyRendererReady: function () {
      window.dispatchEvent(new CustomEvent('kryon-renderer-ready'));
    },
  };
})();
