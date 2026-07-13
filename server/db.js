/**
 * db.js
 * -----------------------------------------------------------------------
 * Banco de dados simples baseado em arquivo JSON (server/data/db.json).
 * Não é destinado a altíssima concorrência, mas é perfeito para o volume
 * de um painel de clientes de agência de divulgação, e evita dependências
 * nativas (como sqlite3) que podem falhar em builds/deploys diferentes.
 *
 * Para migrar futuramente para Postgres/Mongo/Supabase, basta reescrever
 * as funções abaixo mantendo a mesma assinatura (contrato) - o resto do
 * sistema não precisa mudar.
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Estrutura inicial do banco, criada apenas se o arquivo ainda não existir
function defaultData() {
  const senhaHash = bcrypt.hashSync('jumbo989', 10);
  return {
    admin: {
      email: 'carlos800009@gmail.com',
      senhaHash,
      nome: 'Administrador'
    },
    clientes: [
      {
        id: 1,
        nome: 'Carlos',
        telefone: '62993334430',
        planos: ['grupos', 'privado', 'trafego'], // plano completo = todos
        status: 'ativo',
        grupos: { enviados: 18420, meta: 39000, cliques: 1287 },
        privado: { enviados: 7420, meta: 15000, cliques: 580 },
        trafego: {
          cliques: 2458,
          meta: 6000,
          anuncios: { facebook: true, instagram: true, linkedin: false, google: true }
        },
        criadoEm: new Date().toISOString(),
        ultimoAcesso: null
      }
    ],
    nextId: 2
  };
}

function ensureDbFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
  }
}

function read() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler o banco de dados, recriando arquivo padrão.', e);
    const fresh = defaultData();
    write(fresh);
    return fresh;
  }
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { read, write, DB_PATH };
