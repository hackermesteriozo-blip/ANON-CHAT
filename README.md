# ANON CHAT

Chat web em tempo real com tema escuro roxo, cadastro/login por e-mail e senha e sala pública `#geral`. Frontend estático para GitHub Pages + Firebase Authentication + Cloud Firestore.

## Arquivos
- `index.html` — interface e formulários
- `style.css` — design responsivo
- `app.js` — autenticação e mensagens em tempo real
- `firebase-config.js` — configuração do seu app Firebase
- `firestore.rules` — regras de segurança do banco

## 1. Criar o projeto Firebase
1. Acesse https://console.firebase.google.com/ e crie um projeto (por exemplo `anon-chat`).
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Em **Authentication → Settings → Authorized domains**, confirme que o domínio onde publicará o site está autorizado. Adicione seu domínio `SEU-USUARIO.github.io` se necessário.
4. Em **Firestore Database**, crie um banco de dados. Escolha uma região adequada; a região do banco não pode ser trocada depois sem migrar.
5. No Console Firebase, vá a **Configurações do projeto → Seus apps → Web app**. Registre um app Web e copie a configuração.

## 2. Configurar `firebase-config.js`
Substitua todos os valores de exemplo pela configuração exata exibida pelo Firebase. Não publique senhas de contas de serviço, chaves privadas ou arquivos de service account. A configuração web do Firebase é pública por design; a segurança deve vir das regras e da autenticação.

## 3. Publicar as regras do Firestore
No Console Firebase, abra **Firestore Database → Rules**, substitua o conteúdo pelas regras do arquivo `firestore.rules` e clique em **Publish**. Não use regras abertas como `allow read, write: if true`.

As regras deste projeto permitem que qualquer usuário autenticado leia a sala geral e crie mensagens com o próprio UID. Mensagens não podem ser editadas ou apagadas pelo cliente. Isto é uma sala pública para usuários autenticados, não conversas privadas entre duas pessoas.

## 4. Testar localmente
Como o projeto usa módulos JavaScript, evite abrir `index.html` diretamente como `file://`.
- Se tiver Python instalado, abra o terminal na pasta do projeto e execute: `python -m http.server 8000`
- Acesse `http://localhost:8000`.
- Configure o domínio `localhost` em Authentication → Settings → Authorized domains se o Firebase pedir.
- Cadastre uma conta de teste e envie uma mensagem.

## 5. Publicar no GitHub Pages
1. Acesse https://github.com/new e crie um repositório chamado `anon-chat`.
2. Envie os arquivos desta pasta para a raiz do repositório (`index.html`, `style.css`, `app.js`, `firebase-config.js`, `firestore.rules`, `README.md`).
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/ (root)`, depois clique em **Save**.
6. Aguarde a publicação. O endereço será parecido com `https://SEU-USUARIO.github.io/anon-chat/`.
7. Se necessário, adicione `SEU-USUARIO.github.io` aos domínios autorizados do Firebase Authentication.

## Observações importantes
- GitHub Pages hospeda somente o frontend estático. Firebase fornece login, banco e atualização em tempo real.
- Este protótipo usa uma única sala geral; todos os usuários autenticados veem as mensagens dessa sala.
- Não há mensagens privadas, envio de imagens, bloqueio de usuários, moderação ou criptografia ponta a ponta neste primeiro pacote.
- Para produção, acrescente limites de uso, moderação/denúncia, política de privacidade, proteção contra abuso e monitoramento de custos. Configure alertas de orçamento no Firebase; alertas não são necessariamente limites rígidos.
- Não reutilize senhas pessoais em contas de teste.
