# Relatório de validação do backend

Data: 20/10/2026  
Branch: `chore/backend-hardening`

## Comandos e resultados

| Verificação | Comando / ambiente | Resultado observado |
|---|---|---|
| Testes unitários | `cd backend && npm test` | 7 arquivos, 66 testes aprovados. |
| Cobertura unitária V8 | `cd backend && npm run test:cov` | 66 testes aprovados; 58,71% statements, 40,28% branches, 41,53% functions, 61,31% lines. O relatório é da suíte unitária e não agrega e2e. |
| Typecheck | `cd backend && npm run typecheck` | Aprovado (`tsc --noEmit`). |
| Lint | `cd backend && npm run lint` | Aprovado, sem avisos. |
| Formatação | `cd backend && npm run format:check` | Aprovado. |
| Build NestJS | `cd backend && npm run build` | Aprovado após gerar Prisma Client. |
| Vulnerabilidades npm | `cd backend && npm audit --audit-level=moderate` | 0 vulnerabilidades reportadas na árvore completa. O build Docker também reportou 0 na instalação de produção. |
| E2E em PostgreSQL real | `DATABASE_URL=postgresql://test:…@127.0.0.1:55432/test?schema=public npm run test:e2e` | 4 arquivos, 40 testes aprovados em cada uma de duas execuções. |
| Migrations em base vazia | `npm run prisma:migrate:deploy` contra PostgreSQL 17 temporário | As 5 migrations foram aplicadas com sucesso. |
| Seed em base vazia | `npm run prisma:seed` contra a mesma base isolada | Build e seed passaram; `Ensured 7 case opportunities.` |
| Seed repetida | E2E de preservação e duas rodadas e2e | 7 oportunidades permanecem; IDs de itens e alterações comerciais são preservados. |
| Build de imagem sem cache | `docker compose ... build --no-cache` em projeto temporário | Imagens `migrate` e `backend` construídas sem cache. |

As duas execuções finais e2e passaram com migrations e seed presentes. Uma tentativa anterior no banco isolado vazio, antes de executar a seed, falhou em dois testes que exigem OPP-2001; depois de documentado o pré-requisito e aplicada a seed, a suíte passou em ambas as repetições.

## PostgreSQL, seed e integridade

No banco limpo após seed e antes de o scheduler iniciar, as contagens foram:

| Entidade | Quantidade |
|---|---:|
| `Salesperson` | 3 |
| `Opportunity` | 7 |
| `OpportunityItem` | 7 |
| `StageTransition` | 0 |
| `FollowUpAlert` | 0 |

As etapas encontradas foram uma oportunidade em `PRIMEIRO_CONTATO`, uma em `APRESENTACAO_ORCAMENTO`, duas em `FOLLOW_UP`, uma em `FORECAST`, uma em `FECHAMENTO` e uma em `PERDIDA`, correspondendo ao PDF. A sequence começou em 2008 com `is_called = false`. Os testes PostgreSQL reservaram um código da sequence e forçaram uma falha após `nextval`; a API respondeu 409 para a colisão, 500 genérico para a falha forçada e nunca reutilizou os números consumidos.

## Concorrência e fluxos HTTP

Os 40 testes PostgreSQL/e2e cobriram:

- Geração simultânea de códigos, colisão de código reservado e avanço não transacional da sequence.
- PATCH contra PATCH na mesma versão; apenas uma alteração é persistida e a outra recebe 409.
- PATCH contra transição; uma operação vence, a outra recebe 409 e o histórico corresponde ao estado final.
- Duas transições simultâneas; uma vence e há exatamente um registro de histórico.
- Inserção de histórico forçada a falhar; atualização e incremento de versão são revertidos.
- Fluxo integrado de venda: criação com itens/valor, Apresentação, Follow-up, atividade, Forecast, Fechamento, histórico, bloqueio de nova movimentação e resolução do alerta.
- Fluxo integrado de perda: atividade, motivo obrigatório, histórico, alerta resolvido e nenhum alerta aberto em estado terminal.
- PATCH, transição e atividade concorrentes com soft delete; não há escrita após exclusão e registros existentes permanecem preservados.
- Scheduler contra soft delete e reconhecimento manual; alertas duplicados ou abertos obsoletos não permanecem.
- Corridas reais no índice parcial de alertas, idempotência, reconciliação de referência e seed.
- Datas de atividade sem offset rejeitadas; UTC e datas futuras verificadas.

## Docker, HTTP e resiliência

Validação executada em stack Compose temporária independente (`grupo-nobre-crm-hardening`), com volume `hardening_data` próprio e API na porta `13001`:

| Cenário | Resultado |
|---|---|
| Build Docker sem cache | `backend` e `migrate` construídos. |
| Startup | PostgreSQL saudável, `migrate` terminou com exit 0, backend iniciou e ficou saudável. |
| Usuário do backend | `uid=1000(node) gid=1000(node)`. |
| Consultas HTTP | `/api/health` e `/api/opportunities?limit=100` responderam 200; API listou 7 registros. |
| Restart do backend | Health 200 e 7 oportunidades após restart. |
| Restart do PostgreSQL e persistência | Durante indisponibilidade, health 503 e listagem 500 genérico; após recuperação, health e listagem voltaram a 200 com 7 oportunidades. |
| Logs de erro HTTP | Resposta 500 continha mensagem genérica, correlation ID, timestamp e path; sem URL, credencial ou detalhe interno do banco. |
| Scheduler durante indisponibilidade | Com intervalo de 1s somente no Compose temporário, logou falhas enquanto PostgreSQL estava parado e voltou a registrar `Follow-up alert evaluation completed` após o banco retornar. A API ficou saudável. |
| Compose do projeto | O stack preexistente continuou ativo e saudável; não foi reiniciado nem teve seu volume tocado. |

O banco temporário, o volume e as redes foram removidos após a validação. O serviço PostgreSQL temporário do e2e também foi removido. O Compose principal permaneceu em execução.

## Migrations, seed e riscos não resolvidos

- Todas as 5 migrations foram aplicadas em PostgreSQL vazio, sem `migrate reset` e sem `down -v` no stack principal.
- Seed não cria histórico, atividades, motivos não fornecidos ou alertas passados; a primeira avaliação do scheduler pode criar alertas atuais, como esperado.
- Nenhuma vulnerabilidade foi reportada por `npm audit` na data da validação.
- A API segue sem autenticação, conforme o escopo do case. Exposição fora de rede local/controlada depende de autenticação e autorização.
- Pool e timeouts do adapter PostgreSQL não estão explicitamente calibrados no código. Reavaliar com volume e latência reais.
- Cobertura V8 reportada mede somente unitários; o e2e cobre operações PostgreSQL, mas a ferramenta não foi configurada para agregar coverage e2e. O resultado de 58,71% global unitário não deve ser interpretado como cobertura total do backend.
