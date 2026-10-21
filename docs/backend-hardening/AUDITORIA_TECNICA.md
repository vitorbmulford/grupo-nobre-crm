# Auditoria técnica do backend

Data da auditoria: 20/10/2026  
Branch: `chore/backend-hardening`  
Fonte funcional do desafio: `Case_Tecnico_Dev_Full_Stack_Pleno_Grupo_Nobre.pdf`

## Escopo e método

Auditoria dos módulos `opportunities`, `pipeline`, `activities` e `follow-up-automation`, da aplicação NestJS, dos contratos HTTP, do Prisma/PostgreSQL, das migrations, da seed, da configuração Docker e das verificações existentes. O PDF foi extraído integralmente e comparado com a seed, as regras do pipeline e a automação descritas no README.

O diagnóstico iniciou com branch `chore/backend-hardening` e árvore limpa. Nenhum arquivo preexistente foi sobrescrito. A suíte e2e foi executada em um PostgreSQL 17 temporário, isolado do serviço e do volume principais. O teste operacional de Docker usou outro projeto Compose, rede, volume e porta; esses recursos temporários foram removidos ao final. Não houve commit, troca de branch ou alteração da `master`.

As classificações distinguem regra explícita do case, escolha complementar do projeto, implementação e evidência de teste. Ausência de teste é tratada como lacuna, não como prova de defeito.

## Matriz de rastreabilidade

| Requisito ou regra | Origem | Implementação | Testes | Situação | Evidência |
|---|---|---|---|---|---|
| Cinco etapas comerciais ordenadas e estado `PERDIDA`; Fechamento e Perdida são finais | Explícito no PDF, seção 02 | `OpportunityStage`, `pipeline-policy.ts` | `pipeline-policy.spec.ts`; `opportunities.e2e-spec.ts` | Atendido | Enum e política cobrem os seis estados. A matriz parametrizada percorre as 36 combinações origem/destino. |
| Avançar para Apresentação exige valor estimado e pelo menos um item | Explícito no PDF | `evaluateTransition`; persistência dos itens em `opportunities.service.ts` | Policy unitária e fluxo HTTP de transição | Atendido | Pré-condições verificadas no servidor com os dados persistidos. |
| Fechamento somente a partir de Forecast | Explícito no PDF | `pipeline-policy.ts` | Matriz e testes e2e de transição | Atendido | Outras origens são rejeitadas; Forecast → Fechamento é permitido. |
| Perdida a partir de qualquer etapa não final, com motivo obrigatório | Explícito no PDF | `pipeline-policy.ts`; salva `lossReason` e transição | Matriz, testes de policy e fluxo e2e de perda | Atendido | Justificativa é aparada e fica na oportunidade e no histórico. O registro importado OPP-2007 preserva a ausência de motivo do case. |
| Retornos comerciais e justificativa | Decisão aberta pelo PDF; decisão do projeto no README | Retorno de uma etapa ativa por vez; motivo obrigatório | Matriz completa e testes de policy | Atendido | Saltos e retornos maiores que uma etapa são rejeitados. |
| Histórico de movimentos, atomicidade e imutabilidade pela API | Explícito no PDF | `StageTransition`; transação no serviço; endpoint somente GET | Concorrência de transição, trigger de falha e rollback | Atendido | Uma transição concorrente gera um registro; falha ao inserir histórico reverte etapa e versão. |
| Oportunidade criada no Primeiro Contato com código único a partir de OPP-2008 | Complemento do projeto | `opportunity_code_seq`; geração no serviço; unique constraint | E2E concorrente, colisão reservada e falha forçada no INSERT | Atendido | Unicidade é garantida pelo PostgreSQL. Os testes confirmam avanço sem reutilização após colisão e rollback; lacunas são aceitas. |
| PATCH parcial com controle otimista e substituição transacional de itens | Complemento do projeto | DTOs, `version`, `updateMany` condicionado e transação | E2E de atualização, versão obsoleta, dois PATCH concorrentes e PATCH contra transição/delete | Atendido | Apenas uma operação com a mesma versão vence; campos omitidos são preservados; itens substituídos junto aos campos. |
| Soft delete idempotente, sem remoção de relacionamentos | Complemento do projeto | `deletedAt`, leituras filtradas e incremento de versão | E2E de exclusão e races contra PATCH, transição, atividade e scheduler | Atendido | `deletedAt` original, itens, atividades, histórico e alertas resolvidos permanecem no banco; endpoint não restaura nem remove fisicamente. |
| Seed fiel e idempotente | Dados explícitos no PDF; mecânica complementar do projeto | `prisma-seed.ts`, `upsert` sem atualização dos registros existentes | Seed em banco limpo e reexecuções e2e preservando IDs e edições | Atendido | 3 vendedores, 7 oportunidades, 7 itens; datas e valores do PDF; sem histórico, atividades ou alertas artificiais. Campos intencionalmente vazios preservados. |
| Atividades tipadas, imutáveis, sem avanço automático do pipeline | Automação complementar do projeto | `Activity`, DTOs e serviço | E2E de tipos, validação, filtros, ordem, rollback e contatos em estados terminais | Atendido | Criar contato não cria `StageTransition`; atividades não têm endpoint de edição/exclusão. |
| `lastContactAt` em data UTC, monotônico, com versionamento | Complemento do projeto | Transação com lock da oportunidade e avanço condicional da data | E2E de contatos simultâneos e contatos antigos | Atendido | Data mais nova vence; versão avança uma vez quando a data avança; rollback preserva atomicidade. |
| Quatro critérios de risco, reconhecimento e reconciliação | Escolha explícita do problema 4 no PDF; política complementar | `follow-up-risk-policy.ts`, `AlertsService` e índice parcial | Testes de limites com relógio fixo, idempotência, re-referência e índice concorrente | Atendido | Retorno vencido, contato parado, proposta vencida e evento próximo têm limites UTC determinísticos. |
| Scheduler não deixa uma oportunidade falha impedir as demais; recupera após falha | Resiliência pedida nesta auditoria | `AlertsService.evaluate` isola falha por oportunidade; `FollowUpSchedulerService` libera execução no `finally` | Specs de falha isolada e retry; indisponibilidade/recuperação real no Compose temporário | Atendido | Erros são contabilizados e registrados sem dados comerciais; execução subsequente conclui. |
| Validação HTTP, erros, CORS, Helmet, correlação e logs sem segredos | Requisitos de robustez desta auditoria; segurança descrita pelo case | `configure-http.ts`, DTOs, filtro global e Pino | E2E HTTP para propriedades desconhecidas, IDs, validação, CORS, correlação e sanitização | Atendido | 500 genérico não expõe detalhes internos; teste de falha PostgreSQL confirmou resposta genérica. |
| Docker, migrations limpas, healthcheck e persistência | Operação requerida nesta auditoria | Compose, Dockerfile multi-stage, `migrate deploy`, volume PostgreSQL nomeado | Build sem cache, inicialização, HTTP, restart e banco indisponível/recuperado | Atendido no ambiente isolado | API foi executada como usuário `node`; health respondeu 503 durante indisponibilidade e 200 após recuperação; 7 registros persistiram. |
| Autenticação | O case não exige implementação completa; orienta descrever proteção de produção | Não implementada nesta branch | Não aplicável | Risco conhecido | API sem autenticação deve permanecer em ambiente local/controlado até ser protegida antes de exposição externa. |

## Inventário das regras comerciais

### Matriz de transições

`✓` permitido sob a condição indicada; `—` proibido. A diagonal é proibida (não existe movimento para a mesma etapa). Retornos de uma etapa exigem justificativa; a perda exige motivo.

| Origem \ destino | Primeiro Contato | Apresentação | Follow-up | Forecast | Fechamento | Perdida |
|---|---:|---:|---:|---:|---:|---:|
| Primeiro Contato | — | ✓ valor e item | — | — | — | ✓ motivo |
| Apresentação | ✓ motivo | — | ✓ sequencial | — | — | ✓ motivo |
| Follow-up | — | ✓ motivo | — | ✓ sequencial | — | ✓ motivo |
| Forecast | — | — | ✓ motivo | — | ✓ | ✓ motivo |
| Fechamento | — | — | — | — | — | — |
| Perdida | — | — | — | — | — | — |

Não se criam transições históricas para importar uma etapa atual. O PDF não fornece o caminho percorrido pelas sete oportunidades; por isso a seed mantém histórico vazio. `OPP-2007` permanece Perdida sem razão, pois o campo estava em branco na fonte; a validação obrigatória aplica-se às novas transições pela API.

### Oportunidades e código

- O código vem de uma sequência PostgreSQL iniciada em 2008; constraint `UNIQUE` mantém códigos reservados mesmo após soft delete.
- Uma lacuna na numeração pode ocorrer se a criação falhar ou o código já estiver ocupado: `nextval` não é revertido por rollback. O teste cobre a colisão e a falha de persistência e confirma que o próximo código segue adiante.
- Valores são armazenados em `DECIMAL(14,2)` e enviados como texto decimal. A validação aceita até 12 dígitos inteiros e duas casas decimais, compatível com o banco.
- Campos omitidos em PATCH são preservados; `null` limpa os campos opcionais. `items`, quando informado, substitui a lista inteira na mesma transação. `stage` é propriedade não permitida no PATCH comercial.
- Depois da oportunidade sair do primeiro estágio, a API impede que uma edição remova dados de orçamento previamente estabelecidos. Registros legados já incompletos ainda aceitam alterações não relacionadas; a próxima transição para Apresentação valida valor e item persistidos.
- Soft delete define `deletedAt` uma vez, incrementa `version` e mantém as relações. Operações concorrentes são serializadas por atualização condicional, controle de versão ou lock por linha onde necessário.

### Atividades

Os cinco tipos (`CALL`, `EMAIL`, `MEETING`, `WHATSAPP`, `OTHER`) representam contato realizado. Descrição é obrigatória e aparada. Timestamps de atividade e de retorno agendado precisam conter `Z` ou offset ISO explícito para não depender do fuso do processo. Contatos futuros são rejeitados. A atividade e a atualização monotônica de `lastContactAt` são atômicas; contatos antigos não fazem a data retroceder. Contatos em oportunidade terminal são aceitos e não mudam etapa.

### Follow-up

- `FOLLOW_UP_OVERDUE`: retorno agendado no instante avaliado ou antes.
- `CONTACT_STALE`: sem retorno agendado e mais de sete dias-calendário UTC desde o último contato.
- `PROPOSAL_EXPIRED`: validade anterior ao dia UTC de avaliação.
- `CUSTOMER_EVENT_NEAR`: evento hoje até sete dias UTC no futuro, inclusive.

Uma oportunidade terminal ou excluída não ganha risco novo. O índice parcial único em `(opportunityId, type)` para alertas `OPEN` é a proteção final contra duplicação concorrente. Acknowledgment respeita o mesmo tipo e referência até a condição desaparecer ou sua referência mudar. O scheduler reavalia alertas abertos de oportunidades excluídas para resolvê-los.

## Problemas encontrados e correções

| Severidade | Problema e evidência | Correção | Resultado |
|---|---|---|---|
| Médio | `AlertsService.evaluate` capturava apenas conflito de índice único e relançava qualquer outra falha. Um registro com erro interrompia a reconciliação dos seguintes. | Isolar falhas por oportunidade, contar `failed` e emitir log estruturado com ID e classe do erro. Conflito do índice continua contado como concorrência bem-sucedida. | Spec força a primeira oportunidade a falhar e confirma reconciliação da segunda; scheduler também é testado para executar novamente após falha. |
| Médio | `occurredAt` e `nextFollowUpAt` aceitavam ISO local sem offset, cuja interpretação depende do fuso do host. | DTOs agora exigem `Z` ou `±HH:MM`; README descreve o contrato. | E2E rejeita timestamp sem fuso e aceita timestamps UTC com `Z`. |
| Baixo (documentação de teste) | A suíte e2e pressupõe os dados do case. A primeira execução no banco isolado antes da seed falhou nos dois testes que dependem de OPP-2001; os demais passaram. | README agora registra as etapas `migrate deploy`, seed e e2e em base dedicada e alerta que a suíte cria/remover registros e usa triggers temporários. | Com seed aplicada, 40 e2e passaram em duas execuções consecutivas. |

Não foram encontrados defeitos críticos ou altos conhecidos após as correções. A primeira falha de geração Prisma observada na baseline ocorreu porque `npm test` e `npm run typecheck` foram disparados paralelamente, e ambos executam `prisma generate`; a execução serial passou. As verificações finais foram seriais.

## Banco, migrations e seed

Cinco migrations versionadas foram inspecionadas e aplicadas em PostgreSQL 17 vazio:

1. `20261020150000_initial_opportunities`
2. `20261020170000_stage_transitions`
3. `20261020190000_activities`
4. `20261020200000_activity_sort_indexes`
5. `20261020210000_follow_up_alerts`

Constraints verificadas incluem unicidade do código e vendedor, valor não negativo, versão não negativa, quantidade positiva, nomes/descrições não vazios, FKs `RESTRICT`, consistência entre status e datas de resolução/acknowledgment, além do índice parcial de alerta aberto. Campos de calendário usam `DATE`; instantes usam `TIMESTAMPTZ(3)`. A seed em base limpa produziu 3 vendedores, 7 oportunidades, 7 itens, zero transições e zero alertas. A suíte confirmou reexecução idempotente, preservação de IDs e preservação de edição comercial e de itens.

Nenhuma migration corretiva foi necessária; as alterações de auditoria foram validações e resiliência de serviço, sem mudança de esquema.

## Testes e evidências

Testes adicionados nesta auditoria:

- `src/opportunities/pipeline/pipeline-policy.spec.ts`: matriz de 36 pares origem/destino.
- `src/alerts/alerts.service.spec.ts`: erro isolado por oportunidade sem abortar o lote.
- `src/alerts/follow-up-scheduler.service.spec.ts`: execução recupera após falha.
- E2E em `test/opportunities.e2e-spec.ts`: fluxo de venda, fluxo de perda, colisão/falha da sequência, dois PATCH concorrentes, PATCH versus transição e PATCH versus exclusão.
- E2E em `test/activities.e2e-spec.ts`: atividade versus exclusão e rejeição de horário sem offset.
- E2E em `test/alerts.e2e-spec.ts`: scheduler versus exclusão e scheduler versus reconhecimento manual.

Resultados detalhados e comandos estão em `RELATORIO_VALIDACAO.md`. A cobertura V8 unitária é de 58,71% statements, 40,28% branches, 41,53% functions e 61,31% lines. O relatório não inclui instrumentação e2e; cobertura geral de `opportunities.service.ts` aparece baixa na suite unitária porque suas garantias são verificadas nos testes PostgreSQL e2e.

## Segurança, performance e observabilidade

- O `ValidationPipe` global transforma DTOs, rejeita propriedades extras e formata erros. IDs de rota usam `ParseUUIDPipe`; filtros de ordenação têm allowlist; páginas são limitadas a 100.
- CORS valida origens HTTP(S) exatas, Helmet aplica cabeçalhos de segurança e a exceção de CSP é limitada ao Swagger. O filtro retorna erro 500 genérico e remove valores de query de mensagens HTTP; logs estruturados sanitizam credenciais, tokens, emails, URLs de conexão e payloads. Testes exercitam correlação e sanitização.
- As listagens limitam campos de resumo, usam paginação e desempate por ID. O scheduler busca candidatos sem relações completas e processa cada oportunidade em uma transação curta, com lock no registro da oportunidade para serializar mudança comercial, exclusão e reconciliação.
- Índices cobrem consultas por exclusão/etapa/vendedor, histórico, atividade e alertas. Não há evidência de N+1 nas rotas de detalhe e listagem; consulta de oportunidade inclui relações em uma ida ao Prisma.
- A conexão usa `PrismaPg` com string de conexão validada. O código não define limites/timeouts explícitos de pool para o adapter; revisar valores padrão e ajustar com métricas quando a carga real for conhecida.
- A execução da API permanece sem autenticação conforme o escopo do case. Não expor fora de rede local/controlada sem uma camada de autenticação e autorização.

## Docker e resiliência

O Dockerfile usa estágios separados para dependências, build, migration e runtime. `migrate` aplica migrations e seed; backend espera PostgreSQL saudável e migration concluída. Runtime e job de migration usam usuário `node`. PostgreSQL não fica exposto à rede ingress; o host acessa somente bind loopback. O teste operacional isolado confirmou inicialização, migrations, seed, HTTP, usuário não root, restart e persistência. Com intervalo temporário de 1 segundo, o scheduler registrou falhas repetidas enquanto PostgreSQL estava parado e concluiu novas avaliações após o banco voltar. O healthcheck HTTP fez 503 durante a indisponibilidade e retornou 200 depois.

## Decisões técnicas

- Nenhuma refatoração ampla, biblioteca, framework, serviço externo ou migration foi introduzida.
- O controle otimista por `version` permanece a regra para edições e transições concorrentes; locks `FOR UPDATE` existentes são usados apenas nas fronteiras que precisam serializar atividade, alerta ou reconciliação.
- Lacunas de códigos são aceitas como comportamento normal de sequence PostgreSQL; a regra auditada é unicidade.
- Os dados em branco do case continuam sem inferência. A seed não fabrica contatos, histórico ou alertas.

## Riscos residuais e critérios de aceite

| Critério | Resultado |
|---|---|
| Comparação das regras com o PDF e matriz de transições | Atendido e parametrizado. |
| Invariantes de valor/itens, código, histórico, atividades e soft delete | Atendido por constraints, policies e testes PostgreSQL. |
| Fluxos de venda e perda; follow-up; exclusão; concorrência | Atendido em e2e integrado, incluindo corridas entre módulos listadas no relatório. |
| Seed fiel/idempotente e migrations em base limpa | Atendido. |
| Idempotência e recuperação do scheduler | Atendido; falha por oportunidade e outage/recovery ensaiados em isolamento. |
| Contratos HTTP, healthcheck, Docker, restart e persistência | Atendido em ambiente Docker temporário. |
| Nenhum defeito crítico ou alto conhecido | Atendido após correções. |
| Autenticação antes de disponibilizar a API fora de ambiente controlado | Pendente por escopo; risco documentado e bloqueador para exposição externa. |
| Pool/timeouts calibrados por carga de produção | Pendente por ausência de perfil de carga e configuração explícita do adapter. |
| Cobertura agregada de unitários e e2e por módulo | Parcial: relatório V8 mede a suíte unitária; e2e passou duas vezes, mas não foi instrumentado junto. |

A auditoria considera os critérios funcionais e operacionais exercitados atendidos. A API não está pronta para exposição pública sem autenticação, e a configuração do pool não foi calibrada para produção.
