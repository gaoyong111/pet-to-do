import { app, BrowserWindow } from 'electron';

let isQuitting = false;

export function isAppQuitting(): boolean {
  return isQuitting;
}

export function markAppQuitting(): void {
  isQuitting = true;
}

/** 从设置等窗口请求退出：先标记再关闭所有窗口 */
export function requestAppQuit(): void {
  if (isQuitting) return;
  isQuitting = true;

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.close();
    }
  }

  app.quit();
}
