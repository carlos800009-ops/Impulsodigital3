/**
 * middleware/auth.js
 * -----------------------------------------------------------------------
 * Guardas de rota reutilizáveis. Garantem que:
 *  - requireClient: só um cliente autenticado (sessão) acessa seus dados.
 *  - requireAdmin: só o administrador autenticado acessa rotas /admin.
 * Nenhuma rota confia em IDs vindos da URL/body sem checar a sessão -
 * isso impede um cliente de "trocar a URL" e ver dados de outro cliente.
 * -----------------------------------------------------------------------
 */

function requireClient(req, res, next) {
  if (req.session && req.session.clientId) {
    return next();
  }
  return res.status(401).json({ error: 'Não autenticado.' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Acesso administrativo requerido.' });
}

module.exports = { requireClient, requireAdmin };
