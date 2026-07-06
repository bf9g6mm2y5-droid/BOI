// Centralized iOS status bar / PWA theme-color management.
//
// On iOS 26 "Liquid Glass", the status bar reads the <meta name="theme-color">
// tag, but it does not reliably re-read it on every JS mutation - it is most
// reliably re-applied when the page becomes visible again (visibilitychange /
// pageshow). Previously this value was set independently from several
// unrelated places (App.tsx, splash.tsx, dashboard.tsx, login.tsx), which could
// race and leave the status bar showing a stale color (typically stuck on the
// splash screen's blue). All updates should go through this module instead.

export const APP_THEME_COLOR = '#126987';
export const SPLASH_THEME_COLOR = '#000DFF';

export function getExpectedThemeColor(): string {
  return document.body.classList.contains('splash-fullscreen')
    ? SPLASH_THEME_COLOR
    : APP_THEME_COLOR;
}

export function applyThemeColor(color: string = getExpectedThemeColor()): void {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', color);
  }
}
