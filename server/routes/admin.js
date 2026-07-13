const express = require('express');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const PLANOS_VALIDOS = ['grupos', 'privado', 'trafego', 'completo'];
const STATUS_VALIDOS = ['ativo', 'pausado', 'finalizado'];

function normalizePlanos(planos) {
  // "Plano Completo" internamente equivale a ter os 3 serviços ativos
  if (!Array.isArray(planos)) return [];
  if (planos.includes('completo')) return ['grupos', 'privado', 'trafego'];
  return planos.filter((p) => ['grupos', 'privado', 'trafego'].includes(p));
}

function emitUpdate(req, cliente) {
  const io = req.app.get('io');
  if (io) io.to(`cliente-${cliente.id}`).emit('cliente:atualizado', cliente);
}

/** GET /api/admin/clientes - lista todos, com busca e filtro opcional */
router.get('/clientes', (req, res) => {
  const { busca, status } = req.query;
  const data = db.read();
  let clientes = data.clientes;

  if (busca) {
    const termo = busca.toLowerCase();
    clientes = clientes.filter(
      (c) => c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo)
    );
  }
  if (status) {
    clientes = clientes.filter((c) => c.status === status);
  }

  res.json({ clientes });
});

/** POST /api/admin/clientes - cria novo cliente/acesso */
router.post('/clientes', (req, res) => {
  const { nome, telefone, planos } = req.body;

  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });
  const telefoneLimpo = String(telefone || '').replace(/\D/g, '');
  if (!telefoneLimpo || telefoneLimpo.length < 8) {
    return res.status(400).json({ error: 'Telefone inválido.' });
  }
  const planosNormalizados = normalizePlanos(planos);
  if (planosNormalizados.length === 0) {
    return res.status(400).json({ error: 'Selecione ao menos um plano.' });
  }

  const data = db.read();
  const existente = data.clientes.find(
    (c) => c.telefone.replace(/\D/g, '') === telefoneLimpo
  );
  if (existente) {
    return res.status(409).json({ error: 'Já existe um cliente com esse telefone.' });
  }

  const novoCliente = {
    id: data.nextId++,
    nome: nome.trim(),
    telefone: telefoneLimpo,
    planos: planosNormalizados,
    status: 'ativo',
    grupos: { enviados: 0, meta: 39000, cliques: 0 },
    privado: { enviados: 0, meta: 15000, cliques: 0 },
    trafego: {
      cliques: 0,
      meta: 6000,
      anuncios: { facebook: false, instagram: false, linkedin: false, google: false }
    },
    criadoEm: new Date().toISOString(),
    ultimoAcesso: null
  };

  data.clientes.push(novoCliente);
  db.write(data);

  res.status(201).json({ cliente: novoCliente });
});

/** PUT /api/admin/clientes/:id - edita cliente (dados, métricas, status) */
router.put('/clientes/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = db.read();
  const cliente = data.clientes.find((c) => c.id === id);
  if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const { nome, telefone, planos, status, grupos, privado, trafego } = req.body;

  if (nome !== undefined) cliente.nome = String(nome).trim();
  if (telefone !== undefined) cliente.telefone = String(telefone).replace(/\D/g, '');
  if (planos !== undefined) cliente.planos = normalizePlanos(planos);
  if (status !== undefined) {
    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }
    cliente.status = status;
  }

  if (grupos !== undefined) {
    cliente.grupos.enviados = Number(grupos.enviados ?? cliente.grupos.enviados);
    cliente.grupos.meta = Number(grupos.meta ?? cliente.grupos.meta);
    cliente.grupos.cliques = Number(grupos.cliques ?? cliente.grupos.cliques);
  }
  if (privado !== undefined) {
    cliente.privado.enviados = Number(privado.enviados ?? cliente.privado.enviados);
    cliente.privado.meta = Number(privado.meta ?? cliente.privado.meta);
    cliente.privado.cliques = Number(privado.cliques ?? cliente.privado.cliques);
  }
  if (trafego !== undefined) {
    cliente.trafego.cliques = Number(trafego.cliques ?? cliente.trafego.cliques);
    cliente.trafego.meta = Number(trafego.meta ?? cliente.trafego.meta);
    if (trafego.anuncios) {
      cliente.trafego.anuncios = { ...cliente.trafego.anuncios, ...trafego.anuncios };
    }
  }

  db.write(data);
  emitUpdate(req, cliente);

  res.json({ cliente });
});

/** DELETE /api/admin/clientes/:id */
router.delete('/clientes/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = db.read();
  const idx = data.clientes.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado.' });

  data.clientes.splice(idx, 1);
  db.write(data);

  res.json({ ok: true });
});

/** GET /api/admin/dashboard - métricas agregadas para o dashboard admin */
router.get('/dashboard', (req, res) => {
  const data = db.read();
  const clientes = data.clientes;

  const totalClientes = clientes.length;
  const ativos = clientes.filter((c) => c.status === 'ativo').length;
  const finalizados = clientes.filter((c) => c.status === 'finalizado').length;
  const pausados = clientes.filter((c) => c.status === 'pausado').length;

  const totalDivulgacoes = clientes.reduce(
    (soma, c) => soma + (c.grupos?.enviados || 0) + (c.privado?.enviados || 0),
    0
  );
  const totalCliques = clientes.reduce(
    (soma, c) =>
      soma + (c.grupos?.cliques || 0) + (c.privado?.cliques || 0) + (c.trafego?.cliques || 0),
    0
  );

  // Série de "crescimento" simulada a partir da data de criação dos clientes
  const porMes = {};
  clientes.forEach((c) => {
    const d = new Date(c.criadoEm);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    porMes[chave] = (porMes[chave] || 0) + 1;
  });
  const crescimento = Object.entries(porMes)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([mes, qtd]) => ({ mes, qtd }));

  const cliquesPorServico = {
    grupos: clientes.reduce((s, c) => s + (c.grupos?.cliques || 0), 0),
    privado: clientes.reduce((s, c) => s + (c.privado?.cliques || 0), 0),
    trafego: clientes.reduce((s, c) => s + (c.trafego?.cliques || 0), 0)
  };

  const acessos = clientes
    .filter((c) => c.ultimoAcesso)
    .sort((a, b) => new Date(b.ultimoAcesso) - new Date(a.ultimoAcesso))
    .slice(0, 10)
    .map((c) => ({ nome: c.nome, ultimoAcesso: c.ultimoAcesso }));

  res.json({
    totalClientes,
    ativos,
    finalizados,
    pausados,
    totalDivulgacoes,
    totalCliques,
    crescimento,
    cliquesPorServico,
    acessos
  });
});

/** PUT /api/admin/config - altera e-mail/senha do administrador */
router.put('/config', (req, res) => {
  const { email, senhaAtual, novaSenha } = req.body;
  const data = db.read();

  if (senhaAtual) {
    const ok = bcrypt.compareSync(senhaAtual, data.admin.senhaHash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' });
  } else {
    return res.status(400).json({ error: 'Informe a senha atual para confirmar alterações.' });
  }

  if (email && email.trim()) data.admin.email = email.trim();
  if (novaSenha && novaSenha.trim()) {
    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres.' });
    }
    data.admin.senhaHash = bcrypt.hashSync(novaSenha, 10);
  }

  db.write(data);
  res.json({ ok: true, email: data.admin.email });
});

/** GET /api/admin/export/excel */
router.get('/export/excel', (req, res) => {
  const data = db.read();
  const linhas = data.clientes.map((c) => ({
    ID: c.id,
    Nome: c.nome,
    Telefone: c.telefone,
    Planos: c.planos.join(', '),
    Status: c.status,
    'Grupos Enviados': c.grupos?.enviados || 0,
    'Cliques Grupos': c.grupos?.cliques || 0,
    'Mensagens Privado': c.privado?.enviados || 0,
    'Cliques Privado': c.privado?.cliques || 0,
    'Cliques Tráfego': c.trafego?.cliques || 0,
    'Criado em': c.criadoEm,
    'Último acesso': c.ultimoAcesso || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="clientes-impulso-digital.xlsx"');
  res.send(buffer);
});

/** GET /api/admin/export/pdf */
router.get('/export/pdf', (req, res) => {
  const data = db.read();
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="clientes-impulso-digital.pdf"');
  doc.pipe(res);

  doc.fontSize(18).fillColor('#0066ff').text('Impulso Digital - Relatório de Clientes', {
    align: 'left'
  });
  doc.moveDown();
  doc.fontSize(10).fillColor('#000');

  data.clientes.forEach((c, i) => {
    doc
      .fontSize(12)
      .fillColor('#0066ff')
      .text(`${i + 1}. ${c.nome} (${c.telefone})`);
    doc
      .fontSize(10)
      .fillColor('#333')
      .text(`Status: ${c.status} | Planos: ${c.planos.join(', ')}`)
      .text(
        `Grupos: ${c.grupos?.enviados || 0} enviados / ${c.grupos?.cliques || 0} cliques`
      )
      .text(
        `Privado: ${c.privado?.enviados || 0} mensagens / ${c.privado?.cliques || 0} cliques`
      )
      .text(`Tráfego: ${c.trafego?.cliques || 0} cliques`);
    doc.moveDown();
  });

  doc.end();
});

module.exports = router;
