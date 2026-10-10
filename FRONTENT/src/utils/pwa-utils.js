export function isStandalone() {
  if (typeof window === 'undefined') return false

  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: minimal-ui)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
    window.navigator?.standalone === true ||
    (typeof document !== 'undefined' && document.referrer?.includes('android-app://'))
  )
}

/**
 * Utility to manage the PWA installation prompt
 */
let deferredPrompt = null;

export function setDeferredPrompt(e) {
    deferredPrompt = e;
}

export function getDeferredPrompt() {
    return deferredPrompt;
}

export function clearDeferredPrompt() {
    deferredPrompt = null;
}

/**
 * Triggers the PWA install prompt
 * @returns {Promise<string>} result - 'accepted' or 'dismissed'
 */
export async function presentInstallPrompt() {
    if (!deferredPrompt) {
        return 'not-available';
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return outcome;
}
