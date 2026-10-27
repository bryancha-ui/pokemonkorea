import { t, tr } from './i18n';

// ── Name entry (player / rival) ──────────────────────────────────────────────
// A small DOM overlay for typing a name. Using a real <input> means it works with a
// hardware keyboard on desktop AND pops the native on-screen keyboard on phones (the
// player taps the field, or it auto-focuses). Returns the trimmed name (or the given
// default if left blank) via the callback.

interface NameOpts {
  title: string;
  subtitle?: string;
  placeholder: string;
  defaultValue: string;
  maxLength?: number;
}

export function promptName(opts: NameOpts, onDone: (name: string) => void): void {
  const maxLength = opts.maxLength ?? 10;

  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(6,8,18,0.86);font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'background:linear-gradient(#182444,#0e1730);border:3px solid #33507e;border-radius:16px;' +
    'padding:22px 20px;width:min(88vw,420px);box-shadow:0 10px 44px rgba(0,0,0,0.6);text-align:center;';

  const title = document.createElement('div');
  title.textContent = tr(opts.title);
  title.style.cssText = 'color:#ffe44e;font-weight:800;font-size:clamp(18px,5vw,24px);margin-bottom:6px;';
  panel.appendChild(title);

  if (opts.subtitle) {
    const sub = document.createElement('div');
    sub.textContent = tr(opts.subtitle);
    sub.style.cssText = 'color:#bcd;font-size:clamp(12px,3.4vw,15px);margin-bottom:16px;line-height:1.45;';
    panel.appendChild(sub);
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.value = opts.defaultValue || '';
  input.maxLength = maxLength;
  input.placeholder = tr(opts.placeholder);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'words');
  input.setAttribute('enterkeyhint', 'done');
  input.style.cssText =
    'width:100%;box-sizing:border-box;font-size:clamp(18px,5vw,22px);padding:12px 14px;border-radius:10px;' +
    'border:2px solid #4a6aa0;background:#0a1226;color:#fff;text-align:center;outline:none;';
  panel.appendChild(input);

  const hint = document.createElement('div');
  hint.textContent = t(`up to ${maxLength} letters`, `${maxLength}자 이내`, `${maxLength}文字まで`);
  hint.style.cssText = 'color:#7a8db0;font-size:11px;margin-top:8px;';
  panel.appendChild(hint);

  const btn = document.createElement('button');
  btn.textContent = t('OK', '확인');
  btn.style.cssText =
    'margin-top:14px;width:100%;font-size:clamp(16px,4.4vw,18px);font-weight:800;padding:12px;border-radius:10px;' +
    'border:none;background:#2e784a;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;';
  panel.appendChild(btn);

  root.appendChild(panel);
  document.body.appendChild(root);

  let done = false;
  const finish = () => {
    if (done) return; done = true;
    const name = (input.value || '').trim().slice(0, maxLength) || opts.defaultValue || 'Trainer';
    root.remove();
    onDone(name);
  };
  btn.addEventListener('click', finish);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(); } });

  // Auto-focus (opens the keyboard on desktop / Android; on iOS the player taps the field).
  setTimeout(() => { try { input.focus(); input.select(); } catch { /* ignore */ } }, 60);
}

/** A simple message panel with an OK button — same look as the name prompt. */
export function showMessage(text: string, onDone: () => void): void {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(6,8,18,0.86);font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;';
  const panel = document.createElement('div');
  panel.style.cssText =
    'background:linear-gradient(#182444,#0e1730);border:3px solid #33507e;border-radius:16px;' +
    'padding:24px 22px;width:min(88vw,440px);box-shadow:0 10px 44px rgba(0,0,0,0.6);text-align:center;';
  const msg = document.createElement('div');
  msg.textContent = tr(text);
  msg.style.cssText = 'color:#eef4ff;font-size:clamp(15px,4vw,19px);line-height:1.55;margin-bottom:18px;';
  const btn = document.createElement('button');
  btn.textContent = t("Let's go!", '시작!', 'はじめる！');
  btn.style.cssText =
    'width:100%;font-size:clamp(16px,4.4vw,18px);font-weight:800;padding:12px;border-radius:10px;' +
    'border:none;background:#2e784a;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;';
  panel.append(msg, btn);
  root.appendChild(panel);
  document.body.appendChild(root);

  let done = false;
  btn.addEventListener('click', () => { if (done) return; done = true; root.remove(); onDone(); });
}
