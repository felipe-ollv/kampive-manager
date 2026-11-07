# Kampive Manager

Portal administrativo React + TypeScript conectado à API local do Kampive. Exige sessão real e autorização administrativa. Não utiliza dados de demonstração nem armazena senha ou token em localStorage.

## Abrir

**https://localhost:8443/manager/**

Use o e-mail e a senha da conta administrativa do aplicativo. A API valida conta ativa, e-mail confirmado e concessão administrativa a cada requisição. A sessão expira após inatividade e é compartilhada com o app no mesmo gateway. Sair encerra essa sessão compartilhada.

## Atualizar o portal local

```sh
npm ci
npm run build
docker compose -f ../kampive-infra/compose.yaml -f local/compose.manager.yaml up -d --no-deps --no-build gateway
```

O gateway monta `dist/` e usa `local/Caddyfile`, preservando as rotas do app e API. O servidor Vite na porta 5174 redireciona navegações para o gateway HTTPS; após editar fontes, execute build para atualizar a versão servida. Não há proxy que remova Secure dos cookies nem CORS aberto.

## Fluxos conectados

- Login, recuperação de senha, consulta de sessão administrativa e logout.
- Paginação no servidor para solicitações, campings, avaliações, usuários e histórico, com 10/25/50 itens, anterior/próxima e totais filtrados. Busca, status, tipo, período, contribuições do usuário e vínculos são filtrados antes do LIMIT. Seletores de camping também são paginados. O painel consulta totais globais e apenas cinco solicitações; nunca reúne todas as páginas. Detalhes são carregados pelo ID. Respostas antigas de buscas são descartadas.
- Aceitar indicação criando rascunho ou vinculando a camping existente.
- Aprovar/rejeitar vínculo, impedindo autoaprovação e preservando conflitos de propriedade.
- Revisar cadastro completo e publicar ou rejeitar.
- Cadastro/edição de camping com catálogo oficial, busca de cidade, contatos, comodidades, ambientes e fotos.
- Upload JPEG/PNG (até 9 fotos por camping e 10 MB por arquivo), organização da capa e publicação/arquivamento.
- Moderação de avaliações com fotos.

Cada operação grava auditoria no servidor. Revisões numéricas impedem sobrescrever alterações concorrentes: em caso de conflito, atualize os dados e revise novamente. Notas internas não são usadas como resposta pública. O resultado de indicações e vínculos aparece nas notificações existentes do app; cadastros completos mantêm seu fluxo separado.

As operações são reais. Em caso de falha de conexão após uma ação, atualize antes de repetir: o servidor pode já ter concluído a operação. O portal não faz repetição automática de mutações. Fotos enviadas mas não vinculadas após abandono de um formulário permanecem no volume local; ficam acessíveis somente à administração até serem associadas a um camping.

## Backend

Migração necessária: `kampive-api/docs/sql/manager.sql`, depois de `administrator-alerts.sql`. Aplicar uma vez como administrador do banco antes de subir a nova API. Nunca colocar credenciais do banco no frontend.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

A integração backend está em `kampive-api/scripts/verify-auth.py` e `verify-manager.py`, usando containers descartáveis. Não executar esses testes no banco de desenvolvimento. A validação manual dos fluxos desta entrega será feita pelo usuário.

Validação da paginação: lint, typecheck e build concluídos. Testes do frontend preparados, mas a execução fora do sandbox não foi autorizada. A primeira execução da integração descartável encontrou um erro na projeção resumida de campings, corrigido; a repetição não foi autorizada. O build final da API passou nos 98 testes Java. Validação funcional final pendente no portal.
