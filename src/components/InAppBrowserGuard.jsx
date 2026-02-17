import React, { useEffect, useState } from 'react';

function InAppBrowserGuard({ children }) {
  const [browserInfo, setBrowserInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';

    // LINE: auto-redirect with openExternalBrowser param
    if (/Line\//i.test(ua)) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('openExternalBrowser')) {
        url.searchParams.set('openExternalBrowser', '1');
        window.location.href = url.toString();
        return;
      }
    }

    // Detect in-app browsers
    const detections = [
      { pattern: /FBAN|FBAV/i, name: 'Facebook' },
      { pattern: /Instagram/i, name: 'Instagram' },
      { pattern: /TikTok/i, name: 'TikTok' },
      { pattern: /Twitter|TwitterAndroid/i, name: 'Twitter' },
      { pattern: /Line\//i, name: 'LINE' },
      { pattern: /MicroMessenger/i, name: 'WeChat' },
      { pattern: /Snapchat/i, name: 'Snapchat' },
    ];

    let detectedApp = null;
    for (const d of detections) {
      if (d.pattern.test(ua)) {
        detectedApp = d.name;
        break;
      }
    }

    // Generic WebView fallback — only if Android AND has 'wv' flag AND no specific app matched
    if (!detectedApp && /Android/i.test(ua) && /\bwv\b/.test(ua)) {
      detectedApp = 'WebView';
    }

    if (detectedApp) {
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      setBrowserInfo({ app: detectedApp, isAndroid, isIOS });
    }
  }, []);

  const handleOpenChrome = () => {
    const { host, pathname, search, hash } = window.location;
    window.location.href = `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  const handleCopyLink = async () => {
    try {
      // Remove openExternalBrowser param if present for a clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('openExternalBrowser');
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard API
      const input = document.createElement('input');
      const url = new URL(window.location.href);
      url.searchParams.delete('openExternalBrowser');
      input.value = url.toString();
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // App-specific instructions
  const getMenuInstruction = (app, isIOS) => {
    if (app === 'Facebook') {
      return isIOS
        ? { en: 'Tap ⋯ at the bottom, then "Open in Safari"', th: 'กดปุ่ม ⋯ ด้านล่าง แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in Chrome"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดใน Chrome"' };
    }
    if (app === 'Instagram') {
      return isIOS
        ? { en: 'Tap ⋯ at the top-right, then "Open in Safari"', th: 'กดปุ่ม ⋯ มุมขวาบน แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in Chrome"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดใน Chrome"' };
    }
    if (app === 'LINE') {
      return isIOS
        ? { en: 'Tap the share icon at the bottom-right, then "Open in Safari"', th: 'กดไอคอนแชร์มุมขวาล่าง แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in other browser"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์อื่น"' };
    }
    if (app === 'TikTok') {
      return isIOS
        ? { en: 'Tap ⋯ at the bottom-right, then "Open in Safari"', th: 'กดปุ่ม ⋯ มุมขวาล่าง แล้วเลือก "เปิดใน Safari"' }
        : { en: 'Tap ⋮ at the top-right, then "Open in browser"', th: 'กดปุ่ม ⋮ มุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์"' };
    }
    // Default for Twitter, WeChat, Snapchat, generic WebView
    const browserName = isIOS ? 'Safari' : 'Chrome';
    return {
      en: `Tap the menu icon (⋮ or ⋯), then "Open in ${browserName}"`,
      th: `กดที่ไอคอนเมนู (⋮ หรือ ⋯) แล้วเลือก "เปิดใน ${browserName}"`,
    };
  };

  if (!browserInfo) {
    return children;
  }

  const instruction = getMenuInstruction(browserInfo.app, browserInfo.isIOS);
  const browserName = browserInfo.isIOS ? 'Safari' : 'Chrome';

  // Determine arrow direction based on app and platform
  const showBottomArrow = browserInfo.isIOS && (browserInfo.app === 'Facebook' || browserInfo.app === 'TikTok');

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Arrow pointing to menu — top-right or bottom-right based on platform/app */}
      {!showBottomArrow && (
        <div className="absolute top-4 right-4 animate-bounce">
          <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 19L19 5M19 5H9M19 5v10" />
          </svg>
        </div>
      )}
      {showBottomArrow && (
        <div className="absolute bottom-20 right-4 animate-bounce">
          <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5L19 19M19 19H9M19 19V9" />
          </svg>
        </div>
      )}

      {/* Warning icon */}
      <div className="mb-6">
        <svg className="w-16 h-16 text-amber-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>

      {/* English */}
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        Open in {browserName}
      </h1>
      <p className="text-base text-gray-600 mb-1 max-w-sm">
        For the best audio experience, please open this link in {browserName}.
      </p>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        {instruction.en}
      </p>

      {/* Thai */}
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        โปรดเปิดใน {browserName}
      </h2>
      <p className="text-base text-gray-600 mb-1 max-w-sm">
        เพื่อการใช้งานเสียงที่สมบูรณ์ โปรดเปิดลิงก์นี้ใน {browserName}
      </p>
      <p className="text-sm text-gray-500 mb-8 max-w-sm">
        {instruction.th}
      </p>

      {/* Android: Open in Chrome button */}
      {browserInfo.isAndroid && (
        <button
          onClick={handleOpenChrome}
          className="w-full max-w-xs bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl text-base mb-3 active:bg-blue-700 transition-colors"
        >
          Open in Chrome / เปิดใน Chrome
        </button>
      )}

      {/* Universal: Copy link button */}
      <button
        onClick={handleCopyLink}
        className="w-full max-w-xs bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-xl text-base active:bg-gray-200 transition-colors"
      >
        {copied ? '✓ Copied! / คัดลอกแล้ว!' : 'Copy Link / คัดลอกลิงก์'}
      </button>
      <p className="text-xs text-gray-400 mt-2 max-w-xs">
        Paste this link in {browserName} / วางลิงก์นี้ใน {browserName}
      </p>
    </div>
  );
}

export default InAppBrowserGuard;
