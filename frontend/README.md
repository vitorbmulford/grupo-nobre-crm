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

Essa URL é usada pelo navegador. Em Docker, o Compose injeta `NEXT_PUBLIC_API_URL` como argumento de build, com o padrão `http://localhost:3001/api`, que aponta para a porta publicada do backend na máquina do usuário. O hostname interno `backend` não pode ser resolvido pelo navegador. Para trocar a URL pública no Compose, defina `NEXT_PUBLIC_API_URL` antes do build; alterações exigem reconstruir a imagem porque valores `NEXT_PUBLIC_*` são incorporados ao bundle do cliente.

O backend permite por padrão `http://localhost:3000` em `CORS_ORIGINS`. Se a porta publicada do frontend mudar, ajuste a allowlist para a origem exata do navegador. Nenhum segredo é enviado ao cliente.

## Execução com Docker

Na raiz do monorepo, configure o `.env` conforme o README principal e execute:

```bash
docker compose up --build
```

O frontend estará em `http://localhost:3000`. A imagem usa build multi-stage, `output: standalone`, processo sem root e healthcheck. O serviço aguarda a API ficar saudável. PostgreSQL e migrations continuam sob a configuração existente do Compose.

## Páginas e dados

- `/` redireciona para `/opportunities`.
- `/opportunities` pesquisa por empresa ou código, usa a paginação de `GET /api/opportunities` e apresenta os campos fornecidos pela API.
- `/pipeline` apresenta as seis etapas oficiais e prepara a estrutura para o quadro. A consulta agregada por todas as páginas e a interação do Kanban ficam para a próxima etapa.
- `/alerts` consulta alertas abertos em `GET /api/alerts` e mostra estados de carregamento, erro e lista vazia.

Os contratos preservam dinheiro como string decimal, datas de calendário como `YYYY-MM-DD` e timestamps como instantes ISO com offset. A listagem não usa dados de demonstração. O cliente HTTP centraliza URL, query string, JSON, respostas sem corpo, erros padronizados, status, AbortSignal e falhas de rede. A interface mantém o texto útil enviado pelo backend; erros sem mensagem específica recebem uma mensagem de fallback.

TanStack Query usa cache por chave centralizada, `staleTime` de 30 segundos, uma nova tentativa para consultas e sem retry automático para mutations. React Query Devtools não é necessário para a primeira tela e não foi adicionado.

## Limitações e próximos passos

Autenticação, CRUD de oportunidades, filtros por etapa/vendedor, consulta detalhada, quadro Kanban com drag-and-drop, histórico, atividades e resolução de alertas não fazem parte desta etapa. A próxima branch recomendada é a interface de oportunidades: filtros comerciais, detalhe e formulário de criação/edição com validação de domínio e concorrência por `version`.
