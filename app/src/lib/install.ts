import { useEffect, useState } from 'react';

/** Sự kiện cài app của Chrome/Edge/Android (Safari iOS không có, chỉ cài thủ công qua nút Chia sẻ). */
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const KEY = 'nuoc-hay:install-dismissed';

/** Gọi sớm ở main.tsx: giữ lại sự kiện beforeinstallprompt để hiện nút "Cài app" khi người dùng muốn. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * 'ios': Safari/Chrome trên iPhone chưa cài → hướng dẫn Chia sẻ → Thêm vào MH chính.
 * 'prompt': trình duyệt cho phép cài bằng nút. 'none': đã cài, đã ẩn, hoặc không hỗ trợ.
 */
export function useInstall() {
  const [, bump] = useState(0);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === '1');
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  const kind: 'ios' | 'prompt' | 'none' = standalone() || dismissed ? 'none' : deferred ? 'prompt' : isIos() ? 'ios' : 'none';
  return {
    kind,
    install: async () => { if (!deferred) return; await deferred.prompt(); deferred = null; bump((n) => n + 1); },
    dismiss: () => { localStorage.setItem(KEY, '1'); setDismissed(true); },
  };
}
