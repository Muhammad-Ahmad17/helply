// GET /api/widget.js
// Serves the embed loader script that any site can drop in with:
//   <script src="https://helply.aamad.app/api/widget.js" data-bot="BOT_ID" defer></script>
//
// The script reads `data-bot` from its own <script> tag, then injects:
//   - A floating launcher button (bottom-right)
//   - An iframe pointing at /embed/BOT_ID, lazily mounted on click
// Everything is scoped to a single `helply-widget` div so it never collides
// with the host page's CSS.
import { getAppUrl } from "@/lib/utils";

export const dynamic = "force-static";
export const revalidate = 300;

export function GET() {
  const appUrl = getAppUrl();

  const js = `(function () {
  if (window.__helplyLoaded) return;
  window.__helplyLoaded = true;

  var script = document.currentScript || document.querySelector('script[src*="/api/widget.js"]');
  var botId = script && script.getAttribute('data-bot');
  if (!botId) {
    console.warn('[Helply] Missing data-bot attribute on script tag.');
    return;
  }

  var APP = ${JSON.stringify(appUrl)};

  var root = document.createElement('div');
  root.id = 'helply-widget';
  root.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483646;font-family:system-ui,-apple-system,sans-serif;';

  var btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open chat');
  btn.style.cssText = 'width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:#0ea5e9;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .15s;';
  btn.onmouseenter = function(){btn.style.transform='scale(1.05)';};
  btn.onmouseleave = function(){btn.style.transform='scale(1)';};
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var frame = null;
  var open = false;

  function buildFrame() {
    var f = document.createElement('iframe');
    f.src = APP + '/embed/' + encodeURIComponent(botId);
    f.title = 'Chat';
    f.style.cssText = 'position:fixed;bottom:90px;right:20px;width:380px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);border:0;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.25);background:#fff;z-index:2147483647;display:none;';
    f.allow = 'clipboard-write';
    document.body.appendChild(f);
    return f;
  }

  function toggle() {
    if (!frame) frame = buildFrame();
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    btn.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
  }

  btn.addEventListener('click', toggle);
  root.appendChild(btn);
  document.body.appendChild(root);

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.helply !== true) return;
    if (e.data.type === 'close' && open) toggle();
  });
})();`;

  return new Response(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
