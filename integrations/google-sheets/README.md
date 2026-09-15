# Integração da aba Licenciados

Os três formulários da LP enviam `POST` para o Apps Script com um único campo
URL-encoded chamado `payload`. Seu valor é JSON com `site_id`, `tipo`, `lead_id`
e os dados do cadastro. O quiz e o formulário de eventos enviam
`tipo: "licenciado"`; o formulário de clientes envia `tipo: "cliente"`.
O receptor aceita também `lead_type: "licenciado"` da LP compacta anterior.

O receptor em `Code.gs` abre a planilha configurada, escolhe a aba **Licenciados**
ou **Clientes** pelo campo `tipo`, usa a primeira linha como cabeçalho e insere
os valores pelas colunas reconhecidas. Se a aba estiver vazia, escreve os
cabeçalhos. Se já houver cabeçalhos, preserva a ordem e acrescenta apenas a
coluna `Lead ID`, caso falte, para impedir duplicação de uma tentativa reenviada.
Faltando a aba ou as colunas Nome e WhatsApp, retorna erro e registra a causa
em **Execuções** do Apps Script; não grava na aba errada.

## Para conectar à planilha existente

1. Abra o projeto Apps Script que fornece a URL `/exec` presente em
   `CONFIG.sheetEndpoint` de `script.js`. Faça uma cópia do código atual antes
   de substituir o receptor, pois o código remoto não está neste repositório.
2. Confira o nome exato das abas **Licenciados** e **Clientes** e os cabeçalhos
   da primeira linha. Caso a planilha use outros nomes, ajuste `LEADS_TABS` e
   `LEADS_COLUMNS` em `Code.gs` antes da implantação.
3. Em **Configurações do projeto → Propriedades do script**, adicione
   `SPREADSHEET_ID` com o ID entre `/d/` e `/edit` da URL da planilha. O dono
   da implantação precisa ter permissão de edição na planilha.
4. Insira `Code.gs` no projeto Apps Script e salve. Em **Implantar → Gerenciar
   implantações**, edite a implantação Web app existente e selecione a nova
   versão. Configure execução como o proprietário e acesso para visitantes
   anônimos da LP. Se criar outra implantação, troque `CONFIG.sheetEndpoint`
   pela nova URL `/exec` e publique a LP atualizada.
5. Teste um cadastro fictício pelo quiz e outro pelo formulário de eventos.
   Confira as linhas na aba **Licenciados** e a tela **Execuções** do Apps
   Script. Repita uma tentativa usando o mesmo `lead_id` em ambiente controlado
   e confirme que não surge outra linha. Teste um cliente na aba **Clientes**.

O navegador usa `sendBeacon` e, se necessário, `fetch` com `no-cors`. Beacon
retornar `true` confirma apenas enfileiramento; uma resposta opaca também não
permite ler o resultado do Apps Script. Por isso a LP registra o evento
`lead_envio_aceito`, jamais `lead_salvo`. A confirmação de gravação exige ver a
linha ou a execução do servidor. O backend retorna JSON com `status: "saved"`
ou `"duplicate"` para clientes HTTP que possam ler a resposta.

Rode `node --test tools/test-licensee-sheets.cjs` para validar localmente o
contrato, o destino das abas, o tratamento de cabeçalhos e os reenvios. Esses
testes simulam a planilha; não inserem cadastros reais.
