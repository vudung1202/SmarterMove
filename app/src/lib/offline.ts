import { useEffect, useState } from 'react';

const enabled = 'serviceWorker' in navigator && import.meta.env.PROD;

/** Đăng ký service worker (chỉ bản build) và xin trình duyệt giữ dữ liệu lâu dài. */
export function registerOffline() {
  if (!enabled) return;
  void navigator.serviceWorker.register('./sw.js');
  // Safari/Chrome có thể xóa dữ liệu web khi thiếu chỗ; persist() xin giữ lại lịch sử ván
  void navigator.serviceWorker.ready.then(() => navigator.storage?.persist?.());
}

/** 'ready' khi service worker đã lưu xong mọi file (chơi được khi tắt mạng). */
export function useOfflineReady(): 'ready' | 'loading' | 'off' {
  const [state, setState] = useState<'ready' | 'loading' | 'off'>(enabled ? 'loading' : 'off');
  useEffect(() => {
    if (enabled) void navigator.serviceWorker.ready.then(() => setState('ready'));
  }, []);
  return state;
}
