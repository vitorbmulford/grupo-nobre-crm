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

React Hook Form, Zod, `@hookform/resolvers` e dnd-kit estão instalados como parte da stack planejada. A fundação ainda não implementa formulários comerciais nem drag-and-drop no Kanban.

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
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Essa URL é usada pelo navegador no desenvolvimento fora do Docker, quando o Nest local escuta em `localhost:3002`. No Compose, o valor padrão é `/api`: o navegador mantém a origem `http://localhost` e o Nginx encaminha a chamada ao backend. O Compose injeta o valor como argumento de build porque variáveis `NEXT_PUBLIC_*` são incorporadas ao bundle do cliente; alterações no valor do Compose exigem reconstruir a imagem do frontend. O hostname interno `backend` não deve ser usado pelo navegador.

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
- `/pipeline` consulta todas as páginas de `GET /api/opportunities` e agrupa as oportunidades pelas seis etapas oficiais. A movimentação Kanban fica para a próxima etapa.
- `/alerts` consulta alertas abertos em `GET /api/alerts` e mostra estados de carregamento, erro e lista vazia.

Os contratos preservam dinheiro como string decimal, datas de calendário como `YYYY-MM-DD` e timestamps como instantes ISO com offset. A listagem não usa dados de demonstração. O cliente HTTP centraliza URL, query string, JSON, respostas sem corpo, erros padronizados, status, AbortSignal e falhas de rede. A interface mantém o texto útil enviado pelo backend; erros sem mensagem específica recebem uma mensagem de fallback.

TanStack Query usa cache por chave centralizada, `staleTime` de 30 segundos, uma nova tentativa para consultas e sem retry automático para mutations. React Query Devtools não é necessário para a primeira tela e não foi adicionado.

## Limitações e próximos passos

Autenticação, CRUD de oportunidades, filtros por etapa/vendedor, consulta detalhada, quadro Kanban com drag-and-drop, histórico, atividades e resolução de alertas não fazem parte desta etapa. A próxima branch recomendada é a interface de oportunidades: filtros comerciais, detalhe e formulário de criação/edição com validação de domínio e concorrência por `version`.
