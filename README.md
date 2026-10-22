# Grupo Nobre CRM

CRM interno para acompanhar oportunidades comerciais da Nobre Brindes, visualizar o funil e identificar negociações que precisam de retorno. A automação escolhida para o case é o **Problema 4 — com alto volume de atendimentos, é fácil esquecer de dar retorno a um lead. Como ajudar o vendedor a se organizar?**

## O problema escolhido e a motivação

Uma oportunidade pode passar por orçamento, negociação e prazos de evento antes de chegar a um desfecho. Quando os próximos contatos dependem apenas da memória do vendedor, um retorno combinado pode ficar sem acompanhamento. O projeto automatiza a identificação desses riscos a partir dos dados comerciais registrados no CRM.

**O objetivo não é automatizar a negociação, mas evitar que oportunidades comerciais fiquem sem acompanhamento.** Por isso, a automação se conecta ao pipeline e ao histórico: o estado da oportunidade dá contexto ao risco, e os contatos e retornos registrados ajudam a manter atualizada a informação usada pelas regras. Essa justificativa não pressupõe métricas internas do Grupo Nobre.

## Como a solução funciona

1. O vendedor cadastra e acompanha uma oportunidade, seu estágio e os dados comerciais disponíveis.
2. O CRM persiste último contato, próximo retorno, validade da proposta e data do evento do cliente, quando informados.
3. Um scheduler no NestJS avalia as oportunidades na inicialização do backend e, por padrão, a cada 15 minutos (`FOLLOW_UP_EVALUATION_INTERVAL_MS` configura o intervalo).
4. Regras centralizadas no backend identificam riscos usando um instante de avaliação e critérios de data definidos.
5. Os alertas e seu histórico são persistidos no PostgreSQL.
6. O vendedor consulta alertas no CRM, acessa a oportunidade relacionada e decide como agir; também pode reconhecer um alerta como resolvido.
7. Avaliações seguintes reconciliam os alertas com os dados atuais da oportunidade.
8. Eventos Socket.IO notificam sessões abertas sobre alterações relevantes; o frontend atualiza as consultas afetadas sem exigir recarga manual.

A avaliação automática, o armazenamento, a resolução manual, a reconciliação e a atualização da interface são etapas distintas. O scheduler encontra condições de risco; o banco mantém os registros; o vendedor reconhece a ocorrência; a reconciliação remove pendências que deixaram de corresponder aos dados; e o socket avisa a interface sobre mudanças persistidas.

| Alerta | Condição padrão |
| --- | --- |
| `FOLLOW_UP_OVERDUE` | `nextFollowUpAt` está preenchido e é igual ou anterior ao instante da avaliação. |
| `CONTACT_STALE` | Não há retorno agendado, `lastContactAt` está preenchido e tem mais de 7 dias corridos de calendário UTC. Contato nulo é desconhecido e não gera alerta. |
| `PROPOSAL_EXPIRED` | `proposalValidUntil` é anterior à data UTC da avaliação. |
| `CUSTOMER_EVENT_NEAR` | `customerEventDate` é hoje ou está nos próximos 7 dias corridos; datas passadas ou nulas são ignoradas. |

Cada tipo é avaliado independentemente, então uma oportunidade pode ter vários alertas abertos. Novos alertas são gerados apenas para oportunidades em etapas abertas. Se o risco desaparecer ou sua referência mudar, o alerta anterior é resolvido; uma recorrência futura pode gerar outro registro.

### Decisões por trás da automação

- **Avaliação no backend:** o scheduler verifica riscos mesmo quando nenhum vendedor está com o CRM aberto; o navegador não é responsável por executar a regra.
- **PostgreSQL como histórico:** alertas sobrevivem a reinicializações e podem ser consultados depois de resolvidos.
- **Idempotência e concorrência:** reavaliações não devem duplicar uma ocorrência. Uma chave única parcial e bloqueio da oportunidade protegem a reconciliação; um guard local evita execuções sobrepostas no mesmo processo.
- **Regra única no servidor:** o backend define atrasos e vencimentos para que telas diferentes usem os mesmos critérios.
- **Reconciliação:** uma pendência acompanha a evolução dos dados em vez de continuar aberta quando a condição que a originou mudou ou desapareceu.
- **Testes com tempo controlado:** testes de unidade cobrem limites de datas e regras; testes e2e verificam persistência e integração com o PostgreSQL.

Essas escolhas atendem ao MVP de uma instância simples. Não há lock distribuído ou eleição de líder entre múltiplas instâncias; o banco preserva a unicidade dos alertas abertos, mas múltiplas instâncias podem repetir o trabalho de avaliação.

## Requisitos do case e funcionalidades adicionais

O case pede uma interface para listar, pesquisar, filtrar e consultar oportunidades, um Kanban para mover negociações, uma API REST com PostgreSQL, regras de transição e histórico de etapas, além da escolha de um problema para automação funcional com testes críticos. Também pede propostas para os outros três problemas e documentação de execução, decisões, limitações e uso de IA. O pipeline Kanban, portanto, faz parte do escopo solicitado.

Além desse escopo, o projeto inclui recursos para dar mais contexto e continuidade ao acompanhamento comercial:

| Funcionalidade adicional | O que resolve |
| --- | --- |
| Histórico de atividades (ligações, e-mails, reuniões, WhatsApp registrado manualmente e outros contatos) | Mantém o contexto dos contatos realizados. Ao registrar uma atividade, a data do último contato é atualizada sem inventar interações para os dados importados. |
| Dados empresariais opcionais, como telefone, e-mail, site, localização, pessoa de contato e descrição | Permite registrar contexto útil sem obrigar o vendedor a preencher todos os campos. São dados informados manualmente; não há enriquecimento automático. |
| Alertas persistidos, filtros, histórico e resolução manual | Dá ao vendedor uma fila consultável e permite reconhecer a ocorrência atual sem que ela reabra na avaliação seguinte enquanto o mesmo risco permanecer. |
| Socket.IO entre backend e frontend | Reflete alterações feitas em outra sessão e alertas do scheduler em telas já abertas. |
| Docker Compose com Nginx | Permite subir frontend, API, PostgreSQL, migrations/seed e proxy em serviços separados, com inicialização coordenada e uma origem de acesso. |

### Pipeline e consistência comercial

O Kanban coloca oportunidades por estágio para ajudar o vendedor a localizar negociações que precisam de atenção. As transições são validadas no backend: o avanço para Apresentação de Orçamento exige valor estimado e ao menos um item; Fechamento só pode vir de Forecast; Perdida exige motivo; retornos de uma etapa ativa permitem apenas um passo para trás e exigem justificativa. Fechamento e Perdida são estados finais. Cada mudança grava o histórico na mesma transação da oportunidade, e a versão enviada pelo cliente evita que edições concorrentes sobrescrevam silenciosamente uma mudança recente.

Os campos de contato complementam o cadastro sem equivaler ao **Problema 2** do case. A proposta para aquele problema descreve pesquisa/enriquecimento de fontes externas verificáveis, com fonte, data e revisão humana; isso não está implementado.

### Por que WebSocket complementa o CRM

Sem sincronização entre sessões, uma tela aberta poderia continuar exibindo dados antigos depois de uma edição em outra sessão ou da geração de um alerta pelo scheduler. O NestJS publica eventos pequenos de oportunidade, atividade e alerta depois que a gravação correspondente é concluída. O Next.js recebe os eventos pelo Socket.IO e o TanStack Query invalida as consultas relacionadas, que então buscam os dados atuais pela API REST.

**O WebSocket não substitui a automação. Ele complementa a experiência, permitindo que os resultados da automação sejam refletidos na interface sem atualização manual da página.** O PostgreSQL e as rotas REST continuam como fontes da verdade; o evento é uma notificação, não um registro completo nem um comando comercial. Ao reconectar, o frontend revalida consultas para recuperar o estado atual, pois não há replay garantido de eventos. Mantivemos o MVP sem Redis, RabbitMQ ou outro distribuidor: a implantação é simples e de instância única, e o projeto não promete sincronização entre várias instâncias.

## Stack e arquitetura

| Parte | Tecnologias e responsabilidade |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, TanStack Query, React Hook Form, Zod e dnd-kit. Interface de oportunidades, pipeline, atividades e alertas. |
| Backend | NestJS 12, TypeScript, Prisma 7 e Socket.IO. API REST, regras comerciais, scheduler, persistência e publicação de eventos. |
| Banco | PostgreSQL 17 para oportunidades, vendedores, itens, atividades, transições e alertas. Valores monetários usam `DECIMAL(14,2)`. |
| Infraestrutura | Docker Compose e Nginx. Serviços separados para frontend, API, banco e migrations/seed; Nginx faz o proxy de HTTP e Socket.IO. |
| Qualidade | Vitest, ESLint/Oxlint, TypeScript, builds e migrations versionadas do Prisma. |

O frontend consome a API em `/api`. No Compose, o PostgreSQL fica em rede interna; o Nginx publica a aplicação no host. O serviço de migrations aguarda o banco, aplica as migrations e executa o seed idempotente das sete oportunidades do case antes da API. Essa divisão torna a inicialização local reproduzível sem acoplar a lógica comercial ao navegador. Detalhes estão nos READMEs do [backend](backend/README.md) e [frontend](frontend/README.md).

## Executar com Docker Compose

Pré-requisitos: Docker com Compose v2 e uma porta local disponível. Na raiz do repositório:

```bash
cp .env.example .env
docker compose up --build -d
```

Acesse `http://localhost`; Swagger em `http://localhost/api/docs` e saúde da API em `http://localhost/api/health`. `HTTP_HOST_PORT` altera a porta publicada pelo Nginx. O volume nomeado `postgres_data` mantém os dados entre reinicializações; `docker compose stop` para os serviços sem remover o volume. Consulte [backend/README.md](backend/README.md#environment) para variáveis e [frontend/README.md](frontend/README.md) para detalhes do cliente.

Para desenvolvimento local sem Docker, disponibilize um PostgreSQL acessível pelo host e configure `DATABASE_URL` no `.env` da raiz. Execute migrations e seed em `backend/`, inicie a API com `npm run start:dev` e, em outro terminal, copie `frontend/.env.example` para `.env.local` e rode `npm run dev`. Nesse modo, o frontend usa `http://localhost:3000` e a API `http://localhost:3002`; configure `NEXT_PUBLIC_REALTIME_URL=http://localhost:3002` e `CORS_ORIGINS` conforme o README de cada serviço.

## Demonstração da automação

1. Inicie o Compose e abra `/opportunities`.
2. Em uma oportunidade de etapa aberta, edite `Próximo follow-up` para um horário passado (com `Z` ou offset UTC) e salve.
3. Aguarde a avaliação periódica, de até 15 minutos por padrão, ou reinicie o backend para provocar uma avaliação de inicialização: `docker compose restart backend`.
4. Abra `/alerts`, localize `FOLLOW_UP_OVERDUE` e siga para a oportunidade relacionada.
5. Resolva o alerta manualmente e confira o histórico de resolvidos. Enquanto a mesma condição permanecer, a avaliação não reabre essa ocorrência. Também é possível mover a data do retorno para o futuro e observar a resolução automática na próxima avaliação.

O produto não tem endpoint administrativo para forçar uma avaliação. Para regras com instantes fixos, consulte os testes indicados em [backend/README.md](backend/README.md#testing-the-automation).

## Propostas para os outros problemas do case

Estas são ideias de evolução, não funcionalidades implementadas.

### Problema 1 — Primeiro contato e SLA

Registrar entrada do lead e horário do primeiro atendimento, calcular o tempo contra um SLA configurável e exibir atrasos e indicadores por vendedor. Encaminhar leads sem responsável exigiria uma regra de distribuição. A proposta ajuda a priorizar novos leads; seria necessário definir expediente, feriados, pausas e responsabilidade por leads ainda não atribuídos.

### Problema 2 — Informações sobre a empresa

Permitir pesquisa sob solicitação em fontes empresariais verificáveis e guardar fonte, data de consulta e revisão humana na oportunidade. A proposta reduz pesquisa manual, mas requer provedor e política de qualidade e retenção, e traz custo, cobertura desigual e risco de dados desatualizados. Os campos atuais são preenchidos manualmente.

### Problema 3 — Roteiro de ligação

Apresentar perguntas estruturadas de qualificação e persistir respostas tipadas vinculadas à oportunidade ou atividade. Isso facilita encontrar o contexto depois da ligação; o roteiro precisaria ser mantido e permitir conversas diferentes sem tornar o contato burocrático. O histórico genérico de atividades já existe, mas não há roteiro estruturado.

## Testes e qualidade

Na auditoria final, foram aprovados 74 testes unitários do backend, 43 testes e2e do backend e 59 testes do frontend: **176 testes no total**. Os testes unitários do backend e frontend foram executados novamente durante esta revisão do README e passaram (74 e 59, respectivamente). Os e2e usam PostgreSQL real, migrations e seed; rode-os somente contra um banco descartável, nunca contra dados operacionais. Não são métricas de cobertura nem garantia de ausência de defeitos.

Comandos disponíveis nos diretórios dos serviços:

```bash
# backend
npm test
npm run test:e2e
npm run typecheck
npm run build
npm run lint

# frontend
npm test
npm run typecheck
npm run build
npm run lint
```

## Decisões e limitações

- O projeto implementa a automação do problema 4; os problemas 1, 2 e 3 estão documentados como propostas.
- A API REST e o PostgreSQL são a fonte da verdade; o socket não tem replay garantido.
- Não há autenticação nem isolamento por vendedor. As notificações Socket.IO são globais para clientes conectados à origem permitida; a aplicação não deve ser exposta publicamente sem controles de acesso.
- A avaliação roda em processo e não tem lock distribuído. A garantia de unicidade aberta é por oportunidade e tipo no banco, não uma arquitetura de scheduler distribuído.
- Vendedores precisam estar previamente cadastrados. Informações empresariais opcionais são preenchidas manualmente.
- Itens têm nome e quantidade; o valor estimado pertence à oportunidade, não a cada item. A exclusão lógica preserva histórico e não tem restauração pela API.

## Uso de inteligência artificial

Codex foi usado como apoio durante o desenvolvimento para analisar código e contratos, implementar e revisar alterações, ajustar testes e preparar documentação. As regras e decisões descritas neste README correspondem ao código e aos testes do projeto; a ferramenta não substitui a revisão técnica nem as evidências de execução.
