# Remoção do aviso final do PDF

Esta atualização depende da versão anterior do documento da Online Telecom com o modelo das O.S. e informações simplificadas.

Copie `backend/src/services/internetProviderPdf.service.js` para o mesmo caminho no seu projeto no VS Code. Faça backup e compare o arquivo atual antes de substituí-lo. Reinicie o backend e gere um novo PDF. Arquivos PDF já baixados não são alterados.

Foi removida apenas a frase “As informações acima foram prestadas pela escola e devem ser conferidas pela equipe da CTEC antes do encaminhamento.” do final do PDF. O aviso na tela de prévia continua, assim como o conteúdo da solicitação, cabeçalho, rodapé e fotos opcionais.

Foi gerado um PDF de teste isolado e verificado que a frase não aparece. O sistema completo não foi executado aqui.
