import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { APP_THEME_COLOR, SPLASH_THEME_COLOR } from "@/utils/themeColor";

export default function Splash() {
  const [, navigate] = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Ensure complete state clearing during splash
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('chat') || key.includes('liveChat') || key.includes('tempState') || key.includes('session_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Add splash-specific full screen class for iOS PWA
    document.body.classList.add('splash-fullscreen');
    document.documentElement.style.setProperty('--status-bar-color', SPLASH_THEME_COLOR);
    
    // Comprehensive theme color update for splash screen
    const updateThemeColor = () => {
      const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (themeColorMeta) {
        themeColorMeta.content = SPLASH_THEME_COLOR;
      }
      
      // Create or update additional iOS-specific status bar configuration
      const iosStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
      if (iosStatusMeta) {
        iosStatusMeta.content = 'default';
      }
      
      // Force PWA status bar color update
      if ('setAppBadge' in navigator) {
        // PWA-specific color updates
        document.body.style.backgroundColor = SPLASH_THEME_COLOR;
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 100);
      }
    };
    
    // Update immediately and with delays for iOS PWA
    updateThemeColor();
    setTimeout(updateThemeColor, 50);
    setTimeout(updateThemeColor, 200);
    setTimeout(updateThemeColor, 1000);
    
    // Navigate to login after splash duration (8 seconds total)
    const finalTimer = setTimeout(() => {
      setIsVisible(false);
      // Mark splash as completed in localStorage for proper state tracking
      localStorage.setItem('splash_completed', 'true');
      
      // Force status bar transition BEFORE navigation
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', APP_THEME_COLOR);
      }
      
      // Dispatch event to notify App.tsx that splash is complete
      window.dispatchEvent(new CustomEvent('splashComplete'));
      setTimeout(() => {
        // Always navigate to login after splash for cold starts
        navigate('/login');
      }, 400); // Slightly longer fade for smoother color shift
    }, 5000); // 5 seconds total

    // Cleanup timer and remove splash class
    return () => {
      clearTimeout(finalTimer);
      document.body.classList.remove('splash-fullscreen');
      document.documentElement.style.removeProperty('--status-bar-color');
      // Restore theme-color for main app
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute('content', APP_THEME_COLOR);
    };
  }, [navigate]);

  // Prevent any user interaction during splash
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      data-splash-active
      className={`full-height relative overflow-hidden transition-all duration-500 asset-instant splash-container ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundImage: `url('/IMG_0633_1749764752035.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        userSelect: 'none',
        pointerEvents: 'none',
        opacity: 1,
        visibility: 'visible',
        backgroundColor: SPLASH_THEME_COLOR
      }}
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Prevent any interactions */}
      <div 
        className="absolute inset-0 z-50"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Animated loading spinner positioned where it appears in the screenshot */}
      <div className="absolute" style={{ bottom: '30%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className="flex justify-center">
          <div 
            className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"
            style={{
              animation: 'spin 1s linear infinite',
              opacity: 0.9
            }}
          />
        </div>
      </div>
    </div>
  );
}