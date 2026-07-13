/**
 * ui.js — helpers de interface compartilhados entre todas as páginas.
 * Sem dependências externas além do Font Awesome (via CDN no HTML).
 */

// ---------- Tema (claro/escuro) ----------
const ThemeUI = {
  init() {
    const saved = ThemeUI.get();
    if (saved === 'light') document.body.classList.add('light');
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', ThemeUI.toggle);
      ThemeUI.updateIcon(btn);
    });
  },
  get() {
    return document.cookie.match(/impulso_theme=(\w+)/)?.[1] || 'dark';
  },
  set(theme) {
    document.cookie = `impulso_theme=${theme}; path=/; max-age=31536000`;
  },
  toggle() {
    const isLight = document.body.classList.toggle('light');
    ThemeUI.set(isLight ? 'light' : 'dark');
    document.querySelectorAll('[data-theme-toggle]').forEach(ThemeUI.updateIcon);
  },
  updateIcon(btn) {
    const isLight = document.body.classList.contains('light');
    btn.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  }
};

// ---------- Toasts ----------
function toast(message, type = 'success') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

// ---------- Loader de tela cheia ----------
function showLoader() {
  let el = document.getElementById('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.className = 'loader-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
}
function hideLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.classList.add('hidden');
}

// ---------- Modal de confirmação ----------
function confirmModal({ title, message, confirmText = 'Confirmar', danger = true }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-cancel>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    function close(result) {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    }
    backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(false));
    backdrop.querySelector('[data-confirm]').addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
  });
}

// ---------- Contador animado ----------
function animateCounter(el, endValue, { duration = 900, formatter = (n) => Math.round(n).toLocaleString('pt-BR') } = {}) {
  const startValue = Number(el.dataset.current || 0);
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = startValue + (endValue - startValue) * eased;
    el.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(tick);
    else el.dataset.current = endValue;
  }
  requestAnimationFrame(tick);
}

// ---------- Barra de progresso animada ----------
function animateProgress(el, percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  requestAnimationFrame(() => { el.style.width = `${clamped}%`; });
}

// ---------- Fetch helper com tratamento de erro padrão ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* resposta sem corpo JSON */ }
  if (!res.ok) {
    const message = data?.error || 'Ocorreu um erro inesperado.';
    throw new Error(message);
  }
  return data;
}

document.addEventListener('DOMContentLoaded', ThemeUI.init);
