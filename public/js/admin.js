/* ---------- Estado local ---------- */
let clientesCache = [];
let chartCrescimento = null;
let chartCliques = null;

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  criar: 'Criar acesso',
  relatorios: 'Relatórios',
  config: 'Configurações'
};

/* ---------- Verificação de sessão admin ---------- */
async function checkSession() {
  try {
    const session = await api('/api/auth/session');
    if (session.type !== 'admin') throw new Error('sem sessão');
  } catch {
    window.location.href = 'login.html';
  }
}

/* ---------- Navegação entre views ---------- */
function setupNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.getElementById('btn-ir-criar')?.addEventListener('click', () => switchView('criar'));

  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => (v.hidden = true));
  document.getElementById(`view-${view}`).hidden = false;
  document.getElementById('view-title').textContent = VIEW_TITLES[view];
  document.querySelector('.sidebar').classList.remove('open');

  if (view === 'dashboard') loadDashboard();
  if (view === 'clientes') loadClientes();
}

/* ---------- View: Dashboard ---------- */
async function loadDashboard() {
  try {
    const stats = await api('/api/admin/dashboard');

    animateCounter(document.getElementById('stat-total'), stats.totalClientes);
    animateCounter(document.getElementById('stat-ativos'), stats.ativos);
    animateCounter(document.getElementById('stat-finalizados'), stats.finalizados);
    animateCounter(document.getElementById('stat-divulgacoes'), stats.totalDivulgacoes);

    renderChartCrescimento(stats.crescimento);
    renderChartCliques(stats.cliquesPorServico);
    renderTabelaAcessos(stats.acessos);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function chartColors() {
  const styles = getComputedStyle(document.body);
  return {
    text: styles.getPropertyValue('--text-dim').trim(),
    grid: styles.getPropertyValue('--border-soft').trim(),
    blue: '#0066ff',
    green: '#16d97a',
    purple: '#9457ff'
  };
}

function renderChartCrescimento(dados) {
  const ctx = document.getElementById('chart-crescimento');
  const c = chartColors();
  const labels = dados.map((d) => d.mes);
  const valores = dados.map((d) => d.qtd);

  if (chartCrescimento) chartCrescimento.destroy();
  chartCrescimento = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Novos clientes',
        data: valores,
        borderColor: c.blue,
        backgroundColor: 'rgba(0,102,255,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: c.blue
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: c.text }, grid: { color: c.grid } },
        y: { ticks: { color: c.text, precision: 0 }, grid: { color: c.grid }, beginAtZero: true }
      }
    }
  });
}

function renderChartCliques(dados) {
  const ctx = document.getElementById('chart-cliques');
  const c = chartColors();

  if (chartCliques) chartCliques.destroy();
  chartCliques = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Grupos', 'Privado', 'Tráfego'],
      datasets: [{
        data: [dados.grupos, dados.privado, dados.trafego],
        backgroundColor: [c.green, c.purple, c.blue],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 12, padding: 16 } } }
    }
  });
}

function renderTabelaAcessos(acessos) {
  const tbody = document.querySelector('#tabela-acessos tbody');
  if (acessos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="color:var(--text-faint)">Nenhum acesso registrado ainda.</td></tr>`;
    return;
  }
  tbody.innerHTML = acessos
    .map((a) => `<tr><td>${a.nome}</td><td>${new Date(a.ultimoAcesso).toLocaleString('pt-BR')}</td></tr>`)
    .join('');
}

/* ---------- View: Clientes ---------- */
async function loadClientes() {
  const busca = document.getElementById('busca-cliente').value;
  const status = document.getElementById('filtro-status').value;
  const params = new URLSearchParams();
  if (busca) params.set('busca', busca);
  if (status) params.set('status', status);

  try {
    const { clientes } = await api(`/api/admin/clientes?${params.toString()}`);
    clientesCache = clientes;
    renderTabelaClientes(clientes);
  } catch (err) {
    toast(err.message, 'error');
  }
}

const PLANO_LABELS = { grupos: 'Grupos', privado: 'Privado', trafego: 'Tráfego' };

function renderTabelaClientes(clientes) {
  const tbody = document.querySelector('#tabela-clientes tbody');
  if (clientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-faint)">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = clientes
    .map((c) => {
      const planosTxt = c.planos.length === 3
        ? '<span class="plan-chip">Plano Completo</span>'
        : c.planos.map((p) => `<span class="plan-chip">${PLANO_LABELS[p]}</span>`).join('');
      return `
        <tr>
          <td>${c.nome}</td>
          <td>${formatTelefone(c.telefone)}</td>
          <td>${planosTxt}</td>
          <td><span class="badge badge-${c.status}">${c.status}</span></td>
          <td>${new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
          <td><button class="row-action-btn" data-editar="${c.id}" aria-label="Editar"><i class="fa-solid fa-pen"></i></button></td>
        </tr>`;
    })
    .join('');

  tbody.querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => abrirDrawer(Number(btn.dataset.editar)));
  });
}

function formatTelefone(tel) {
  if (tel.length === 11) return tel.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  return tel;
}

document.getElementById('busca-cliente')?.addEventListener('input', debounce(loadClientes, 300));
document.getElementById('filtro-status')?.addEventListener('change', loadClientes);

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------- View: Criar acesso ---------- */
document.getElementById('form-criar')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('criar-nome').value.trim();
  const telefone = document.getElementById('criar-telefone').value.trim();
  const planos = Array.from(document.querySelectorAll('#form-criar input[name="plano"]:checked')).map((el) => el.value);

  try {
    await api('/api/admin/clientes', { method: 'POST', body: JSON.stringify({ nome, telefone, planos }) });
    toast('Acesso criado com sucesso!', 'success');
    e.target.reset();
    switchView('clientes');
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Drawer: Editar cliente ---------- */
const drawerBackdrop = document.getElementById('drawer-backdrop');

function abrirDrawer(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente) return;

  document.getElementById('editar-id').value = cliente.id;
  document.getElementById('editar-nome').value = cliente.nome;
  document.getElementById('editar-telefone').value = cliente.telefone;
  document.getElementById('editar-status').value = cliente.status;

  document.querySelectorAll('#form-editar input[name="editar-plano"]').forEach((el) => {
    el.checked = cliente.planos.includes(el.value);
  });

  document.getElementById('editar-grupos-enviados').value = cliente.grupos.enviados;
  document.getElementById('editar-grupos-meta').value = cliente.grupos.meta;
  document.getElementById('editar-grupos-cliques').value = cliente.grupos.cliques;

  document.getElementById('editar-privado-enviados').value = cliente.privado.enviados;
  document.getElementById('editar-privado-meta').value = cliente.privado.meta;
  document.getElementById('editar-privado-cliques').value = cliente.privado.cliques;

  document.getElementById('editar-trafego-cliques').value = cliente.trafego.cliques;
  document.getElementById('ad-facebook').checked = !!cliente.trafego.anuncios.facebook;
  document.getElementById('ad-instagram').checked = !!cliente.trafego.anuncios.instagram;
  document.getElementById('ad-linkedin').checked = !!cliente.trafego.anuncios.linkedin;
  document.getElementById('ad-google').checked = !!cliente.trafego.anuncios.google;

  drawerBackdrop.classList.add('show');
}

function fecharDrawer() {
  drawerBackdrop.classList.remove('show');
}
document.getElementById('drawer-close').addEventListener('click', fecharDrawer);
drawerBackdrop.addEventListener('click', (e) => { if (e.target === drawerBackdrop) fecharDrawer(); });

document.getElementById('form-editar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editar-id').value;
  const planos = Array.from(document.querySelectorAll('#form-editar input[name="editar-plano"]:checked')).map((el) => el.value);

  const payload = {
    nome: document.getElementById('editar-nome').value.trim(),
    telefone: document.getElementById('editar-telefone').value.trim(),
    planos,
    status: document.getElementById('editar-status').value,
    grupos: {
      enviados: Number(document.getElementById('editar-grupos-enviados').value || 0),
      meta: Number(document.getElementById('editar-grupos-meta').value || 0),
      cliques: Number(document.getElementById('editar-grupos-cliques').value || 0)
    },
    privado: {
      enviados: Number(document.getElementById('editar-privado-enviados').value || 0),
      meta: Number(document.getElementById('editar-privado-meta').value || 0),
      cliques: Number(document.getElementById('editar-privado-cliques').value || 0)
    },
    trafego: {
      cliques: Number(document.getElementById('editar-trafego-cliques').value || 0),
      anuncios: {
        facebook: document.getElementById('ad-facebook').checked,
        instagram: document.getElementById('ad-instagram').checked,
        linkedin: document.getElementById('ad-linkedin').checked,
        google: document.getElementById('ad-google').checked
      }
    }
  };

  try {
    await api(`/api/admin/clientes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    toast('Cliente atualizado! O painel dele já reflete os novos números.', 'success');
    fecharDrawer();
    loadClientes();
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('btn-excluir-cliente').addEventListener('click', async () => {
  const id = document.getElementById('editar-id').value;
  const confirmado = await confirmModal({
    title: 'Excluir cliente?',
    message: 'Essa ação é permanente e removerá o acesso desse cliente ao painel.',
    confirmText: 'Excluir'
  });
  if (!confirmado) return;

  try {
    await api(`/api/admin/clientes/${id}`, { method: 'DELETE' });
    toast('Cliente excluído.', 'success');
    fecharDrawer();
    loadClientes();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Exportações ---------- */
function exportarExcel() { window.location.href = '/api/admin/export/excel'; }
function exportarPdf() { window.location.href = '/api/admin/export/pdf'; }
document.getElementById('btn-export-excel')?.addEventListener('click', exportarExcel);
document.getElementById('btn-export-pdf')?.addEventListener('click', exportarPdf);
document.getElementById('btn-report-excel')?.addEventListener('click', exportarExcel);
document.getElementById('btn-report-pdf')?.addEventListener('click', exportarPdf);

/* ---------- Configurações ---------- */
document.getElementById('form-config').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('config-email').value.trim();
  const novaSenha = document.getElementById('config-nova-senha').value;
  const senhaAtual = document.getElementById('config-senha-atual').value;

  try {
    await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ email, novaSenha, senhaAtual }) });
    toast('Configurações atualizadas com sucesso!', 'success');
    e.target.reset();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Logout ---------- */
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '../index.html';
});

/* ---------- Init ---------- */
(async function init() {
  await checkSession();
  setupNav();
  loadDashboard();
})();
