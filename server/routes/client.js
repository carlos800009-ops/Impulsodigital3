const express = require('express');
const db = require('../db');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/client/me
 * Retorna somente os dados do cliente logado na sessão atual.
 * O ID nunca vem da URL/query - vem exclusivamente da sessão, então
 * não é possível "trocar a URL" para ver dados de outro cliente.
 */
router.get('/me', requireClient, (req, res) => {
  const data = db.read();
  const cliente = data.clientes.find((c) => c.id === req.session.clientId);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  return res.json({ cliente });
});

module.exports = router;
