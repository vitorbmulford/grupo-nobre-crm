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

React Hook Form, Zod e `@hookform/resolvers` compõem os formulários comerciais de oportunidades. dnd-kit permanece disponível para uma implementação futura do Kanban; drag-and-drop não faz parte desta etapa.

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
- `/pipeline` consulta todas as páginas de `GET /api/opportunities` e agrupa as oportunidades pelas seis etapas oficiais. A movimentação Kanban fica para a próxima etapa.
- `/alerts` consulta alertas abertos em `GET /api/alerts` e mostra estados de carregamento, erro e lista vazia.

### Gestão de oportunidades

- `/opportunities` pesquisa por empresa/código, filtra por etapa e vendedor, ordena pelos campos aceitos pela API e pagina resultados. Cada registro tem ações para abrir, editar ou excluir com confirmação.
- `/opportunities/new` e `/opportunities/[id]/edit` usam React Hook Form, Zod e os componentes shadcn/Base UI existentes. A edição envia `version`; em HTTP 409, os valores digitados permanecem no formulário e a pessoa escolhe quando carregar a versão atual.
- `/opportunities/[id]` apresenta os dados comerciais e itens. A exclusão usa o endpoint lógico `DELETE /api/opportunities/:id` e atualiza o cache do TanStack Query.
- Valores aceitam ponto ou vírgula decimal e são enviados como decimal em string. Datas sem horário permanecem `YYYY-MM-DD`; follow-up é enviado como timestamp ISO com fuso.
- A API de itens aceita somente nome e quantidade: não há preço unitário, total ou valor por item. O formulário captura o valor estimado no nível da oportunidade, sem inventar campos ou endpoints para valores de itens.
- A etapa não é editável no formulário porque o backend exige o endpoint de transição para validar as regras do funil e registrar histórico. A interface desta feature não habilita movimentações.

Os contratos preservam dinheiro como string decimal, datas de calendário como `YYYY-MM-DD` e timestamps como instantes ISO com offset. A listagem não usa dados de demonstração. O cliente HTTP centraliza URL, query string, JSON, respostas sem corpo, erros padronizados, status, AbortSignal e falhas de rede. A interface mantém o texto útil enviado pelo backend; erros sem mensagem específica recebem uma mensagem de fallback.

TanStack Query usa cache por chave centralizada, `staleTime` de 30 segundos, uma nova tentativa para consultas e sem retry automático para mutations. React Query Devtools não é necessário para a primeira tela e não foi adicionado.

## Limitações e próximos passos

O backend não fornece campos de preço por item; itens comerciais têm apenas nome e quantidade, com o valor estimado registrado na oportunidade. A etapa é atualizada exclusivamente pela rota de transição do backend. Kanban com drag-and-drop, movimentação de etapas na interface, histórico de transições, timeline de atividades e resolução de alertas ficam para branches posteriores. Autenticação também não faz parte do escopo atual.
