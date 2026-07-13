const grid = document.getElementById('cards-grid');
const emptyState = document.getElementById('empty-state');
const greeting = document.getElementById('greeting');
const statusLine = document.getElementById('status-line');
const liveIndicator = document.getElementById('live-indicator');

const STATUS_LABELS = {
  ativo: 'Divulgação em andamento',
  pausado: 'Divulgação pausada',
  finalizado: 'Divulgação finalizada'
};

let cardRefs = {}; // plano -> elemento do card, para atualizar sem re-renderizar tudo

async function init() {
  try {
    const { cliente } = await api('/api/client/me');
    renderCliente(cliente);
    connectSocket();
  } catch (err) {
    // Sem sessão válida -> volta para o login
    window.location.href = 'login.html';
  }
}

function renderCliente(cliente) {
  greeting.innerHTML = `Olá, ${cliente.nome}.`;
  statusLine.textContent = STATUS_LABELS[cliente.status] || '';

  const planos = cliente.planos || [];
  if (planos.length === 0) {
    emptyState.hidden = false;
    return;
  }

  if (planos.includes('grupos')) mountCard('grupos', cliente.grupos);
  if (planos.includes('privado')) mountCard('privado', cliente.privado);
  if (planos.includes('trafego')) mountCard('trafego', cliente.trafego);
}

function mountCard(tipo, dados) {
  const tpl = document.getElementById(`tpl-card-${tipo}`);
  const node = tpl.content.firstElementChild.cloneNode(true);
  grid.appendChild(node);
  cardRefs[tipo] = node;
  updateCard(tipo, dados);
}

function updateCard(tipo, dados) {
  const node = cardRefs[tipo];
  if (!node || !dados) return;

  if (tipo === 'grupos' || tipo === 'privado') {
    const counterEl = node.querySelector('[data-counter]');
    const metaEl = node.querySelector('[data-meta]');
    const progressEl = node.querySelector('[data-progress]');
    const cliquesEl = node.querySelector('[data-cliques]');

    animateCounter(counterEl, dados.enviados);
    metaEl.textContent = dados.meta.toLocaleString('pt-BR');
    const pct = dados.meta > 0 ? (dados.enviados / dados.meta) * 100 : 0;
    animateProgress(progressEl, pct);
    animateCounter(cliquesEl, dados.cliques);
  }

  if (tipo === 'trafego') {
    const badgesEl = node.querySelector('[data-ads-badges]');
    const cliquesEl = node.querySelector('[data-cliques]');
    const plataformas = [
      { key: 'facebook', label: 'Facebook', icon: 'fa-brands fa-facebook' },
      { key: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram' },
      { key: 'linkedin', label: 'LinkedIn', icon: 'fa-brands fa-linkedin' },
      { key: 'google', label: 'Google', icon: 'fa-brands fa-google' }
    ];
    badgesEl.innerHTML = plataformas
      .map((p) => {
        const ativo = dados.anuncios?.[p.key];
        return `<span class="ad-badge ${ativo ? 'active' : ''}"><i class="${p.icon}"></i> ${p.label}</span>`;
      })
      .join('');
    animateCounter(cliquesEl, dados.cliques);
  }

  node.classList.add('just-updated');
  setTimeout(() => node.classList.remove('just-updated'), 1000);
}

// ---------- Tempo real via Socket.io ----------
function connectSocket() {
  const socket = io({ withCredentials: true });

  socket.on('connect', () => {
    liveIndicator.style.color = '';
  });

  socket.on('disconnect', () => {
    liveIndicator.innerHTML = '<i class="fa-solid fa-circle"></i> Reconectando...';
  });

  socket.on('cliente:atualizado', (cliente) => {
    renderClienteAtualizacao(cliente);
  });
}

function renderClienteAtualizacao(cliente) {
  statusLine.textContent = STATUS_LABELS[cliente.status] || '';
  if (cardRefs.grupos) updateCard('grupos', cliente.grupos);
  if (cardRefs.privado) updateCard('privado', cliente.privado);
  if (cardRefs.trafego) updateCard('trafego', cliente.trafego);
  toast('Seus números foram atualizados agora mesmo.', 'success');
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = 'index.html';
});

init();
