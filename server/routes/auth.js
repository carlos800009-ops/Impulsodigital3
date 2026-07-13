const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

// Limita tentativas de login para dificultar força bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

function onlyDigits(str = '') {
  return String(str).replace(/\D/g, '');
}

/**
 * POST /api/auth/client-login
 * Body: { telefone }
 * Login simplificado do cliente: apenas telefone, sem senha.
 */
router.post('/client-login', loginLimiter, (req, res) => {
  const telefone = onlyDigits(req.body.telefone);

  if (!telefone || telefone.length < 8) {
    return res.status(400).json({ error: 'Informe um telefone válido.' });
  }

  const data = db.read();
  const cliente = data.clientes.find((c) => onlyDigits(c.telefone) === telefone);

  if (!cliente) {
    return res.status(404).json({ error: 'Acesso não encontrado.' });
  }

  cliente.ultimoAcesso = new Date().toISOString();
  db.write(data);

  req.session.clientId = cliente.id;
  req.session.isAdmin = false;

  return res.json({ ok: true, nome: cliente.nome });
});

/**
 * POST /api/auth/admin-login
 * Body: { email, senha }
 */
router.post('/admin-login', loginLimiter, (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const data = db.read();
  const admin = data.admin;

  if (email.trim().toLowerCase() !== admin.email.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const senhaOk = bcrypt.compareSync(senha, admin.senhaHash);
  if (!senhaOk) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  req.session.isAdmin = true;
  req.session.clientId = null;

  return res.json({ ok: true, nome: admin.nome });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('impulso.sid');
    res.json({ ok: true });
  });
});

/**
 * GET /api/auth/session
 * Informa ao frontend se há sessão ativa (cliente ou admin) e de quem.
 */
router.get('/session', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ type: 'admin' });
  }
  if (req.session && req.session.clientId) {
    const data = db.read();
    const cliente = data.clientes.find((c) => c.id === req.session.clientId);
    if (cliente) return res.json({ type: 'client', nome: cliente.nome });
  }
  return res.json({ type: null });
});

module.exports = router;
