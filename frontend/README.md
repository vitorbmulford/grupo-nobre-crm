# Frontend · Grupo Nobre CRM

Aplicação interna para acompanhar oportunidades comerciais. Esta fundação usa Next.js 16 com App Router, React 19, TypeScript strict, Tailwind CSS v4 e componentes shadcn/ui v4 sobre Base UI. O preset Nova e os componentes existentes foram preservados.

## Stack e scripts

| Ferramenta          | Versão instalada                               |
| ------------------- | ---------------------------------------------- |
| Next.js             | 16.4.2                                         |
| React / React DOM   | 19.3.0                                         |
| Tailwind CSS        | 4.3.3                                          |
| shadcn              | 4.22.1 · Base UI · base-nova                   |
| TanStack Query      | 5.104.5                                        |
| React Hook Form     | 7.90.0                                         |
| Zod                 | 4.6.7                                          |
| @hookform/resolvers | 5.9.2                                          |
| dnd-kit             | core 6.3.1 · sortable 10.0.0 · utilities 3.2.2 |
| TypeScript          | 5.9.3                                          |
| Vitest              | 4.1.12                                         |

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

React Hook Form, Zod e `@hookform/resolvers` compõem os formulários comerciais de oportunidades. dnd-kit implementa o drag-and-drop acessível do Kanban; a mesma transição também pode ser solicitada pelo seletor de etapa de cada cartão.

## Estrutura

- `src/app`: layouts, boundaries e rotas App Router.
- `src/components/ui`: componentes shadcn sobre Base UI.
- `src/components/layout`: sidebar, header e shell do CRM.
- `src/components/shared`: cabeçalho, estados e badge de etapa.
- `src/lib/api`: cliente HTTP, query keys e consultas tipadas.
- `src/lib/constants`: nomes e rótulos das etapas reais da API.
- `src/providers`: QueryClient, tooltips e Sonner.
- `src/types`: contratos das respostas documentadas pelo backend.

## API e ambiente

Crie `frontend/.env.local` com base em `.env.example`:

```dotenv
NEXT_PUBLIC_API_URL=/api
NEXT_LOCAL_API_ORIGIN=http://localhost:3002
```

O navegador chama sempre `/api`, mantendo a mesma origem. Durante `next dev`, o
rewrite do Next encaminha esse caminho a `NEXT_LOCAL_API_ORIGIN`, cujo padrão é
o Nest local em `http://localhost:3002`. Quando Nginx está em uso, ele recebe
`/api` antes do Next e encaminha a chamada diretamente ao backend. A imagem
Docker fixa `/api` no build e `frontend/.env.local` é excluído do contexto de
build; o hostname interno `backend` nunca é exposto ao navegador.

O backend permite `http://localhost` para o acesso pela origem única do proxy e `http://localhost:3000` para desenvolvimento local direto. Nenhum segredo é enviado ao cliente.

## Execução com Docker

Na raiz do monorepo, configure o `.env` conforme o README principal e execute:

```bash
docker compose up --build
```

O frontend estará em `http://localhost`, servido pelo Nginx. O serviço usa build multi-stage, `output: standalone`, processo sem root e healthcheck. Nginx aguarda frontend e backend saudáveis; o frontend aguarda a API. PostgreSQL e migrations permanecem sob a configuração do Compose, e somente Nginx publica uma porta no host.

## Páginas e dados

- `/` redireciona para `/opportunities`.
- `/opportunities` pesquisa por empresa ou código, usa a paginação de `GET /api/opportunities` e apresenta os campos fornecidos pela API.
- `/pipeline` consulta cada uma das seis etapas oficiais separadamente, com filtros por cliente/código e vendedor, carregamento paginado por coluna e opção de ocultar etapas encerradas. Os cartões podem ser movimentados com drag-and-drop ou pelo seletor acessível.
- `/alerts` lista alertas abertos ou resolvidos, filtra por oportunidade, vendedor, tipo e situação, pagina resultados, agrupa alertas da mesma oportunidade e permite resolução manual. O contador da sidebar acompanha a quantidade de alertas abertos.

### Gestão de oportunidades

- `/opportunities` pesquisa por empresa/código, filtra por etapa e vendedor, ordena pelos campos aceitos pela API e pagina resultados. Cada registro tem ações para abrir, editar ou excluir com confirmação.
- `/opportunities/new` e `/opportunities/[id]/edit` usam React Hook Form, Zod e os componentes shadcn/Base UI existentes. A edição envia `version`; em HTTP 409, os valores digitados permanecem no formulário e a pessoa escolhe quando carregar a versão atual.
- `/opportunities/[id]` apresenta os dados comerciais e itens. A exclusão usa o endpoint lógico `DELETE /api/opportunities/:id` e atualiza o cache do TanStack Query.
- A tela de detalhes reúne atividades append-only e transições de etapa em ordem cronológica, permite registrar contatos e carrega atividades anteriores sob demanda.
- Valores aceitam ponto ou vírgula decimal e são enviados como decimal em string. Datas sem horário permanecem `YYYY-MM-DD`; follow-up é enviado como timestamp ISO com fuso.
- A API de itens aceita somente nome e quantidade: não há preço unitário, total ou valor por item. O formulário captura o valor estimado no nível da oportunidade, sem inventar campos ou endpoints para valores de itens.
- A etapa não é editável no formulário porque o backend exige o endpoint de transição para validar as regras do funil e registrar histórico. Movimentações acontecem no Pipeline por drag-and-drop ou pelo seletor alternativo.

Os contratos preservam dinheiro como string decimal, datas de calendário como `YYYY-MM-DD` e timestamps como instantes ISO com offset. A listagem não usa dados de demonstração. O cliente HTTP centraliza URL, query string, JSON, respostas sem corpo, erros padronizados, status, AbortSignal e falhas de rede. A interface mantém o texto útil enviado pelo backend; erros sem mensagem específica recebem uma mensagem de fallback.

TanStack Query usa chaves centralizadas em `src/lib/api/queries.ts`, `staleTime` de 30 segundos, uma nova tentativa para consultas e sem retry automático para mutations. As mutations invalidam as listas, detalhes, histórico e contador de alertas relacionados; a transição de etapa só atualiza o cartão após confirmação da API. A integração em tempo real descrita abaixo invalida queries específicas sem criar uma camada paralela de estado. Os alertas continuam sendo reconciliados pelo scheduler do backend no intervalo configurado, então mudanças comerciais que afetam riscos podem levar até esse intervalo para alterar os alertas persistidos.

## Sincronização em tempo real

`RealtimeSync` abre uma conexão Socket.IO compartilhada pelo provider da
aplicação no browser; não há socket por página ou componente. O servidor emite
somente IDs e versão opcional. Eventos de oportunidade invalidam listagens,
Kanban, detalhe e histórico daquela oportunidade; atividades invalidam o
histórico de atividades e detalhe; alertas invalidam listas, contador e alertas
da oportunidade. Isso preserva filtros, navegação, paginação e dados exibidos
durante falhas, sem duplicar estado remoto.

Após reconectar, queries relevantes são revalidadas. Ao voltar para uma aba
visível, uma revalidação com limite de frequência cobre eventos perdidos. Uma
falha de WebSocket não bloqueia o REST. No cenário local sem Nginx, configure
`NEXT_PUBLIC_REALTIME_URL=http://localhost:3002` em `.env.local`; com Compose ou
frontend local atrás do Nginx, a origem da aplicação é usada automaticamente.
O Next rewrite atende o REST durante desenvolvimento, mas não faz proxy do
Socket.IO; nesse cenário direto, a URL explícita conecta ao Nest.

O canal é global e sem autenticação neste MVP, não fornece isolamento por
vendedor e não garante replay. O backend é a fonte da verdade. Ver contrato,
CORS e limites no [README do backend](../backend/README.md#atualizações-em-tempo-real).

## Automação escolhida no case

O case escolheu o **problema 4: organização dos retornos comerciais**. A implementação existente é a automação de alertas de follow-up no backend, exibida e resolvida nesta interface. O scheduler é a autoridade sobre as regras e persistência dos alertas; o frontend não cria alertas nem recalcula riscos. Os tipos, limites, reconhecimento manual e propostas para os problemas 1, 2 e 3 estão descritos em [backend/README.md](../backend/README.md#follow-up-risk-automation).

Foi usada IA para apoiar a leitura dos fluxos, a comparação entre contratos do backend e frontend, a identificação de inconsistências e a atualização desta documentação. As alterações e afirmações deste relatório foram confrontadas com o código e os comandos registrados na auditoria. A inspeção visual foi somente de leitura, em 986 px e tema escuro do sistema, nas rotas de oportunidades, Pipeline, alertas e detalhes; não foram verificados tamanhos de celular nem os outros temas.

## Limitações e próximos passos

O backend não fornece campos de preço por item; itens comerciais têm apenas nome e quantidade, com o valor estimado registrado na oportunidade. A etapa é atualizada exclusivamente pela rota de transição do backend. O frontend ainda não oferece autenticação, atualização em tempo real entre sessões ou alteração manual do estado dos alertas além do endpoint de resolução existente.
