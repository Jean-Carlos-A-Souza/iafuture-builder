export function isTauriRuntime() {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

export async function checkAndApplyShellUpdate(onEvent) {
  const config = typeof window !== 'undefined' ? (window.KRYON_DESKTOP_CONFIG || {}) : {};

  if (!isTauriRuntime() || config.autoUpdateEnabled !== true) {
    return { checked: false, updated: false };
  }

  onEvent?.({
    phase: 'skipped',
    reason: 'Auto update do shell ainda nao esta habilitado nesta versao do desktop.',
  });

  return { checked: true, updated: false };
}
