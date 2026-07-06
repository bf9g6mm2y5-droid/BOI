import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { detectAndHandleDeviceChange } from "./utils/deviceDetection";

const preloadCriticalAssets = () => {
  const criticalAssets = [
    '/boi_logo.svg',
    '/Icons_Fingerprint.svg',
    '/icon_HID.svg',
    '/IMG_0633_1749764752035.jpeg'
  ];
  
  criticalAssets.forEach(asset => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = asset;
    document.head.appendChild(link);
  });
};

const ensureFontsLoaded = () => {
  document.fonts.ready.then(() => {
    document.body.classList.add('fonts-loaded');
  });
};

async function initializeApp() {
  await detectAndHandleDeviceChange();
  
  preloadCriticalAssets();
  ensureFontsLoaded();
  
  createRoot(document.getElementById("root")!).render(<App />);
}

if ('serviceWorker' in navigator) {
  let reloadScheduled = false;
  
  const scheduleGracefulReload = (reason: string) => {
    if (reloadScheduled) return;
    reloadScheduled = true;
    console.log(`🔄 Scheduling graceful reload: ${reason}`);
    
    if (document.hidden) {
      const reloadOnVisible = () => {
        document.removeEventListener('visibilitychange', reloadOnVisible);
        console.log('🔄 App visible again - reloading for update');
        window.location.reload();
      };
      document.addEventListener('visibilitychange', reloadOnVisible);
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_ACTIVATED') {
      console.log(`🎉 App updated to v${event.data.version || '4.7.0'}!`);
      
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #126987 0%, #0e5a75 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        animation: slideDown 0.3s ease-out;
      `;
      banner.innerHTML = `✅ App Updated to v${event.data.version || '4.7.0'} - Latest Features Active!`;
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideDown {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(banner);
      
      setTimeout(() => {
        banner.style.animation = 'slideDown 0.3s ease-in reverse';
        setTimeout(() => banner.remove(), 300);
      }, 4000);
    }
    
    if (event.data && event.data.type === 'SW_STALE_BUNDLE') {
      console.warn('⚠️ Stale bundle detected after update:', event.data.url);
      scheduleGracefulReload('stale bundle after update');
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service worker controller changed - new version active');
    if (document.hidden) {
      const reloadOnVisible = () => {
        document.removeEventListener('visibilitychange', reloadOnVisible);
        window.location.reload();
      };
      document.addEventListener('visibilitychange', reloadOnVisible);
    }
  });
}

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && typeof event.reason === 'object' && 'message' in event.reason) {
    const msg = (event.reason as Error).message || '';
    if (msg.includes('Failed to fetch dynamically imported module') || 
        msg.includes('Loading chunk') || 
        msg.includes('Loading CSS chunk')) {
      console.warn('⚠️ Module load failed (likely after update) - reloading...');
      event.preventDefault();
      const hasReloaded = sessionStorage.getItem('sw_update_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('sw_update_reload', 'true');
        window.location.reload();
      } else {
        sessionStorage.removeItem('sw_update_reload');
      }
    }
  }
});

initializeApp();
