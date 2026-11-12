# Endereço informado pelo gestor com confirmação administrativa

## Fluxo
- Em novo atendimento, o endereço vem vazio e deve ser preenchido pelo gestor. O envio salva o endereço na solicitação, mas não muda o cadastro da escola.
- No painel Internet das Escolas, abra Detalhes da solicitação. Apenas o perfil administrador vê “Comparar e confirmar endereço”.
- A tela compara o endereço atual do cadastro com o endereço enviado. Confirme com a escola se necessário e assegure-se de que se trata do endereço da escola, não apenas do equipamento. “Confirmar e atualizar cadastro” substitui o campo `endereco` da escola vinculada, sem alterar o município, o status da solicitação ou o histórico da própria solicitação.
- A alteração registra endereço anterior, novo, solicitação, administrador e data em `internetAddressHistory` no documento da escola. Esse histórico não é exibido na interface nesta entrega. Se a solicitação não tiver endereço válido ou estiver excluída, não poderá ser confirmada. Se o endereço já for igual, não há necessidade de alteração. Se o cadastro mudar enquanto o administrador analisa, é preciso comparar novamente.
- As duas rotas de consulta/confirmação exigem autenticação e perfil admin no backend; esconder o botão não é a única proteção.

## Aplicar

Faça backup e compare seus arquivos antes de substituir. Copie mantendo os caminhos:

- `frontend/src/pages/InternetPublic.jsx`
- `frontend/src/pages/InternetInstallation.jsx`
- `frontend/src/pages/InternetRequests.jsx`
- `backend/src/models/School.js`
- `backend/src/routes/internet.routes.js`

A atualização depende das entregas anteriores completas do módulo, do comunicado e do visual azul, inclusive `internet-portal.css`, imagem GPON e serviço PDF. Ela mantém o reinício simplificado da última atualização. Não copia arquivos .env e não requer migração: o histórico começa a ser registrado em novas confirmações. Reinicie frontend e backend; em produção gere e publique novo build. Faça backup do banco antes de colocar em produção.

A importação existente de escolas pode sobrescrever `endereco` novamente com o valor do arquivo importado; ela não foi alterada nesta entrega. O histórico registra apenas confirmações por este novo fluxo, não edições manuais nem importações.

## Verificações
O build do frontend e a sintaxe do backend passaram. Testes isolados com dados e modelos simulados verificaram proteção por perfil, comparação, confirmação, histórico, alterações concorrentes e solicitações excluídas. Não foram executados o sistema completo nem uma conexão real com MongoDB. Teste em ambiente seguro com conta admin e não admin antes de usar dados reais.
