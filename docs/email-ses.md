# Canal de e-mail: configuração da Amazon SES

Checklist de produção do canal de e-mail (#79–#81). Região: `sa-east-1` (envio e recebimento).

## 1. Domínio (`EMAIL_DOMINIO`, ex.: `atendimento.operacondo.com.br`)

Cada cliente recebe `{nome}@EMAIL_DOMINIO`, e as respostas saem desse mesmo endereço.

1. SES → *Identities* → *Create identity* → domínio `EMAIL_DOMINIO`, com **Easy DKIM** (RSA 2048).
2. No DNS do domínio:
   - os 3 `CNAME` de DKIM que a SES mostra;
   - **MX** `10 inbound-smtp.sa-east-1.amazonaws.com` (recebimento);
   - **SPF** com *custom MAIL FROM* (ex.: `bounce.atendimento...`): `MX 10 feedback-smtp.sa-east-1.amazonses.com`
     e `TXT "v=spf1 include:amazonses.com ~all"` nesse subdomínio;
   - **DMARC**: `TXT _dmarc.atendimento... "v=DMARC1; p=quarantine; rua=mailto:dmarc@operacondo.com.br"`
     (começar com `p=none` e subir depois de ver os relatórios).
3. Esperar a identidade ficar *Verified* e pedir a saída do *sandbox* da SES (sem isso só envia
   para endereços verificados).

## 2. Recebimento

1. Bucket S3 (privado) para o e-mail bruto, com política que permite `ses.amazonaws.com` gravar.
2. Tópico SNS → `SES_ENTRADA_TOPICO` = ARN do tópico; assinatura HTTPS em
   `{APP_URL}/api/email/ses` (a aplicação confirma sozinha).
3. *Email receiving* → *Rule set* ativo → regra para `EMAIL_DOMINIO`: ação **S3** (bucket acima,
   com o tópico SNS) e *spam and virus scanning* ligado.

## 3. Credenciais e variáveis

- Usuário/papel IAM com `ses:SendEmail`, `ses:SendRawEmail` e `s3:GetObject`/`s3:DeleteObject`
  no bucket do bruto.
- `.env`: `EMAIL_DOMINIO`, `SES_ENTRADA_TOPICO`, `SES_REGION` (padrão `sa-east-1`),
  `SES_ACCESS_KEY`/`SES_SECRET_KEY` (ou papel IAM), `SES_REMETENTE` (avisos da plataforma).

## 4. Conferir

- Enviar um e-mail de fora para o endereço do cliente → conversa em `/app/agente`.
- Aprovar o rascunho → a resposta chega na mesma thread, com SPF, DKIM e DMARC `pass` nos
  cabeçalhos (`Authentication-Results`).
