/**
 * server.js
 * -----------------------------------------------------------------------
 * Ponto de entrada do backend Impulso Digital.
 *  - Express para as rotas HTTP/API
 *  - express-session para autenticação por sessão (cliente e admin)
 *  - socket.io para atualização em tempo real do dashboard do cliente
 *
 * IMPORTANTE (segurança em produção):
 *  - Defina SESSION_SECRET no ambiente (.env) com um valor aleatório forte.
 *  - Atrás de HTTPS (ex: Render/Railway/Heroku com proxy), defina
 *    TRUST_PROXY=1 e o cookie de sessão usará secure:true automaticamente.
 *  - As credenciais de admin NÃO ficam fixas no código-fonte após o
 *    primeiro login: a senha é armazenada com hash bcrypt em
 *    server/data/db.json, e pode ser alterada em Configurações.
 * -----------------------------------------------------------------------
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const sessionMiddleware = session({
  name: 'impulso.sid',
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd, // exige HTTPS em produção
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12 // 12 horas
  }
});
app.use(sessionMiddleware);

// Compartilha a sessão do Express com o socket.io, para que cada socket
// só entre na "sala" do cliente autenticado naquela sessão.
io.engine.use(sessionMiddleware);

app.set('io', io);

// --- Rotas da API ---
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// --- Arquivos estáticos do frontend ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback simples (SPA-like) para rotas não encontradas na API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// --- Socket.io: entrada na sala do cliente autenticado ---
io.on('connection', (socket) => {
  const session = socket.request.session;
  if (session && session.clientId) {
    socket.join(`cliente-${session.clientId}`);
  }
});

server.listen(PORT, () => {
  console.log(`Impulso Digital rodando em http://localhost:${PORT}`);
});
