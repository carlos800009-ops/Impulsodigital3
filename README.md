# Impulso Digital — Painel de Acompanhamento de Divulgação

Sistema web completo (frontend HTML/CSS/JS + backend Node.js/Express) para que
uma agência acompanhe, em tempo real, o progresso da divulgação contratada por
cada cliente: Divulgação em Grupos, Prospecção no Privado, Tráfego Pago e
Plano Completo.

## Stack

- **Backend:** Node.js + Express, sessão autenticada (`express-session`),
  senha do admin com hash `bcrypt`, tempo real via `socket.io`.
- **Banco de dados:** arquivo JSON (`server/data/db.json`), gerado
  automaticamente no primeiro start. Fácil de trocar por Postgres/Supabase
  depois — toda a lógica de leitura/escrita está isolada em `server/db.js`.
- **Frontend:** HTML + CSS + JavaScript puro (sem build step), Chart.js para
  os gráficos do admin e Font Awesome para os ícones.
- **Exportações:** Excel real (`xlsx`) e PDF (`pdfkit`).

## Como rodar localmente

```bash
npm install
cp .env.example .env     # ajuste o SESSION_SECRET
npm start
```

Acesse:
- **Site do cliente:** http://localhost:3000
- **Painel administrativo:** http://localhost:3000/admin/login.html

### Credenciais iniciais

| Tipo | Login |
|---|---|
| Cliente de demonstração | telefone `62993334430` (nome "Carlos") |
| Administrador | e-mail `carlos800009@gmail.com` / senha `jumbo989` |

⚠️ **Troque a senha do administrador assim que possível** em
`Painel Admin → Configurações`. A senha já fica salva com hash bcrypt (nunca
em texto puro) e pode ser alterada a qualquer momento — não é mais necessário
editar código-fonte para isso.

## Estrutura do projeto

```
impulso-digital/
├── server/
│   ├── server.js         # ponto de entrada (Express + socket.io + sessão)
│   ├── db.js              # camada de dados (arquivo JSON)
│   ├── middleware/auth.js # guardas de rota (requireClient / requireAdmin)
│   ├── routes/
│   │   ├── auth.js        # login cliente (telefone) e login admin (email+senha)
│   │   ├── client.js      # dados do cliente logado
│   │   └── admin.js       # CRUD de clientes, dashboard, config, exportações
│   └── data/db.json        # banco de dados (criado automaticamente)
├── public/
│   ├── index.html          # tela inicial
│   ├── login.html           # login do cliente (telefone)
│   ├── dashboard.html       # painel do cliente (cards por serviço)
│   ├── admin/
│   │   ├── login.html       # login do administrador
│   │   └── index.html       # painel admin (SPA com sidebar)
│   ├── css/                 # design system + estilos por página
│   └── js/                  # lógica de cada página
├── package.json
└── .env.example
```

## Funcionalidades implementadas

- Tela inicial com logo, nome, texto de boas-vindas e botão
  "ACOMPANHAR DIVULGAÇÃO".
- Login do cliente **apenas por telefone** (sem senha). Telefone não
  cadastrado → mensagem "Acesso não encontrado."
- Painel do cliente com cards independentes por serviço contratado:
  - 📢 Divulgação em Grupos (verde) — contador animado, meta, barra de
    progresso e cliques.
  - 💬 Prospecção no Privado (roxo) — mensagens enviadas e cliques.
  - 🎯 Tráfego Pago (azul) — badges de Facebook/Instagram/LinkedIn/Google e
    cliques.
  - Plano Completo → mostra todos os cards na mesma página.
- **Atualização em tempo real** via WebSocket (`socket.io`): quando o admin
  edita os números de um cliente, o painel dele atualiza sozinho, sem
  recarregar a página, com uma animação de destaque e um toast avisando.
- Painel administrativo (`/admin`) com login por e-mail/senha (hash bcrypt +
  sessão), menu lateral (Dashboard, Clientes, Criar acesso, Relatórios,
  Configurações, Sair).
  - **Dashboard:** total de clientes, ativos, finalizados, total de
    divulgações, gráfico de crescimento de clientes e gráfico de cliques por
    serviço, últimos acessos.
  - **Clientes:** busca por nome/telefone, filtro por status, exportar
    Excel/PDF, editar em um painel lateral (drawer).
  - **Criar acesso:** nome, telefone e plano(s) contratado(s).
  - **Editar cliente:** nome, telefone, plano, status (ativo/pausado/
    finalizado), quantidade de grupos enviados, mensagens privadas, cliques
    de cada serviço e quais redes têm anúncio ativo.
  - **Configurações:** alterar e-mail/senha do administrador (exige senha
    atual).
- Modo escuro/claro (padrão: escuro, no estilo Vercel/Linear), com alternância
  salva em cookie.
- Contadores animados, barras de progresso animadas, cards com sombra/hover,
  loading e toasts de sucesso/erro, modal de confirmação antes de excluir.
- Segurança:
  - Cliente só enxerga os próprios dados — o ID nunca vem da URL, apenas da
    sessão autenticada no servidor.
  - Rotas administrativas protegidas por `requireAdmin`; tentativa de acesso
    sem sessão (ou com sessão de cliente) retorna 401.
  - Limite de tentativas de login (`express-rate-limit`) para dificultar
    força bruta.
  - Senha do admin sempre com hash bcrypt; nunca fica em texto puro no banco.

## Publicando online (deploy)

O projeto é um servidor Node.js comum, então funciona em qualquer provedor
que rode Node (Render, Railway, Fly.io, VPS, etc). Passos gerais:

1. Suba o repositório para o provedor escolhido.
2. Configure as variáveis de ambiente (baseado em `.env.example`):
   - `SESSION_SECRET`: gere um valor aleatório forte
     (`openssl rand -hex 32`).
   - `NODE_ENV=production`
   - `TRUST_PROXY=1` (a maioria dos provedores usa proxy HTTPS na frente).
3. Comando de start: `npm install && npm start`.
4. Troque a senha padrão do administrador assim que o primeiro login for
   feito.

> Observação: o banco em arquivo JSON funciona bem para o volume de uma
> agência (dezenas/centenas de clientes). Se o projeto crescer muito ou
> precisar rodar em múltiplas instâncias ao mesmo tempo, migre `server/db.js`
> para Postgres/Supabase — a interface de `read()`/`write()` foi pensada para
> facilitar essa troca sem mexer nas rotas.

## Próximos passos sugeridos

- Migrar o banco de arquivo JSON para um banco de dados real (Postgres/
  Supabase) quando o volume de clientes crescer.
- Adicionar envio de notificação (e-mail/WhatsApp) quando o admin atualizar
  os números de um cliente.
- Adicionar upload de logo/identidade visual personalizável pela tela de
  Configurações.
