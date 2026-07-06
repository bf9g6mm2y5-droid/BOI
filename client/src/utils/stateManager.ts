// Scroll-position persistence so screens reopen where the user left them.
//
// This used to also snapshot a full copy of the app state - including the
// logged-in user object - into a 'bank_app_state' localStorage blob, plus a
// form-data store. Nothing ever read either of them back (the only reader was
// the removed warm-start auto-login path), so that duplicate copy of the
// user's identity was a pure data-mixing hazard and has been removed. The
// single source of truth for identity is OfflineAuthGuard's bankingUser keys.
export class StateManager {
  private static readonly SCROLL_POSITIONS_KEY = 'bank_app_scroll_positions';

  // Save scroll position for specific route
  static saveScrollPosition(route: string, position: number) {
    try {
      const positions = this.getScrollPositions();
      positions[route] = position;
      localStorage.setItem(this.SCROLL_POSITIONS_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Failed to save scroll position:', error);
    }
  }

  // Get scroll position for route
  static getScrollPosition(route: string): number {
    try {
      const positions = this.getScrollPositions();
      return positions[route] || 0;
    } catch (error) {
      console.error('Failed to get scroll position:', error);
      return 0;
    }
  }

  // Get all scroll positions
  static getScrollPositions(): Record<string, number> {
    try {
      const saved = localStorage.getItem(this.SCROLL_POSITIONS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to get scroll positions:', error);
      return {};
    }
  }

  // Save scroll positions when the app goes to background
  static handleVisibilityChange(currentRoute: string) {
    if (document.visibilityState !== 'hidden') return;

    try {
      const positions = this.getScrollPositions();

      const scrollableElements = document.querySelectorAll('[data-scroll-container]');
      scrollableElements.forEach(element => {
        const container = element as HTMLElement;
        if (container.dataset.scrollRoute) {
          positions[container.dataset.scrollRoute] = container.scrollTop;
        }
      });

      // Save main window scroll if no specific containers
      if (scrollableElements.length === 0) {
        positions[currentRoute] = window.scrollY;
      }

      localStorage.setItem(this.SCROLL_POSITIONS_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Failed to save scroll positions:', error);
    }
  }

  // Restore scroll position after component mount
  static restoreScrollPosition(route: string, elementSelector?: string) {
    setTimeout(() => {
      const position = this.getScrollPosition(route);
      if (position > 0) {
        if (elementSelector) {
          const element = document.querySelector(elementSelector) as HTMLElement;
          if (element) {
            element.scrollTop = position;
          }
        } else {
          window.scrollTo(0, position);
        }
      }
    }, 100);
  }
}
