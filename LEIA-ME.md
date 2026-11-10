# Atualização — painel e exclusão

Esta atualização depende da primeira versão do módulo Internet das Escolas. Ela altera três arquivos:

- `frontend/src/pages/InternetRequests.jsx`
- `backend/src/routes/internet.routes.js`
- `backend/src/models/InternetRequest.js`

Faça backup e compare com seus arquivos atuais antes de substituir, principalmente se já fez alterações próprias. Reinicie o frontend e o backend no seu ambiente. Não é necessário alterar o arquivo da conversa guiada (`InternetPublic.jsx`).

## Alterações

- Painel reorganizado, com indicadores, filtros, distribuição por escola/tipo e tabela de solicitações.
- Somente administradores podem excluir, pela lixeira da tabela ou no detalhe. A API também verifica essa permissão.
- A exclusão pede confirmação e motivo de pelo menos cinco caracteres. O responsável, a data e o motivo são gravados no banco.
- A exclusão é **lógica**: o registro permanece no banco, mas não aparece na listagem, indicadores nem relatório Excel e o link de acompanhamento deixa de funcionar. Não há tela de restauração nesta versão. Portanto, esta operação não apaga definitivamente os dados pessoais.
- A atualização não apaga nem altera automaticamente os pedidos existentes.

## Verificação no seu ambiente

Com dados de teste, entre como administrador, exclua um pedido e confirme que ele não aparece mais na lista, nos indicadores nem no Excel e que seu link de acompanhamento não funciona. Entre como técnico ou atendente e verifique que não existe botão de exclusão. Teste também verificação e encaminhamento. O usuário e o motivo de exclusão ficam no banco, não em uma tela de auditoria.

O sistema e o build não foram executados aqui. A sintaxe dos dois arquivos JavaScript do backend foi verificada, sem conexão com banco.
