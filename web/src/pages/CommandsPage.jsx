import React from 'react';

const COMMANDS = [
  {
    category: 'Uso Basico',
    items: [
      { cmd: 'vertex', desc: 'Inicia a CLI Vertex (faz login, inicia o proxy e abre o terminal interativo).' },
      { cmd: 'vertex auth login', desc: 'Faz login com email e senha (Firebase Auth).' },
      { cmd: 'vertex auth logout', desc: 'Remove o token de autenticacao salvo.' },
      { cmd: 'vertex auth status', desc: 'Mostra se voce esta autenticado e com qual email.' },
      { cmd: 'vertex auth status --json', desc: 'Status da autenticacao em formato JSON.' },
      { cmd: 'vertex-init', desc: 'Cria o arquivo de configuracao ~/.config/vertex/.env.' },
      { cmd: 'vertex-proxy', desc: 'Inicia apenas o proxy FastAPI (sem a CLI interativa).' },
      { cmd: 'vertex --version', desc: 'Mostra a versao instalada do Vertex.' },
    ],
  },
  {
    category: 'Modos de Permissao',
    items: [
      { cmd: 'Modo default', desc: 'Comportamento padrao — a IA pergunta antes de alterar arquivos.' },
      { cmd: 'Modo plan', desc: 'Apenas analise — a IA le e pesquisa mas nao faz alteracoes.' },
      { cmd: 'Modo auto (bypass)', desc: 'Auto aceitar tudo — a IA executa sem pedir confirmacao. Equivalente a --skip-permission-check.' },
      { cmd: '/permission', desc: ' Altera o modo de permissao dentro da sessao interativa.' },
    ],
  },
  {
    category: 'Variaveis de Ambiente',
    items: [
      {
        cmd: 'ANTHROPIC_BASE_URL',
        desc: 'URL do proxy local (http://127.0.0.1:8083). Usado por clientes externos para rotear via Vertex.',
      },
      {
        cmd: 'ANTHROPIC_AUTH_TOKEN',
        desc: 'Token de autenticacao do proxy (padrao: freecc).',
      },
      {
        cmd: 'DEEPSEEK_API_KEY',
        desc: 'Chave da API DeepSeek. Configurada no .env do servidor, nao necessaria para o usuario.',
      },
      {
        cmd: 'MODEL / MODEL_OPUS / MODEL_SONNET / MODEL_HAIKU',
        desc: 'Definem qual modelo DeepSeek cada tier (Opus/Sonnet/Haiku/default) usa.',
      },
    ],
  },
  {
    category: 'Modo CLI Externa (Claude Code)',
    items: [
      {
        cmd: 'ANTHROPIC_AUTH_TOKEN="freecc" ANTHROPIC_BASE_URL="http://localhost:8083" claude',
        desc: 'Usar o Claude Code CLI diretamente roteando pelo proxy Vertex.',
      },
    ],
  },
  {
    category: 'Comandos do CLI Interativo',
    items: [
      { cmd: '/help', desc: 'Mostra a ajuda com todos os comandos disponiveis.' },
      { cmd: '/model', desc: 'Seleciona o modelo (v4-flash ou v4-pro) para usar na sessao.' },
      { cmd: '/clear', desc: 'Limpa o historico da sessao atual.' },
      { cmd: '/permission', desc: 'Altera o modo de permissao (default, plan, acceptEdits, bypassPermissions).' },
      { cmd: '/compact', desc: 'Comprime o contexto da conversa para economizar tokens.' },
      { cmd: '/logout', desc: 'Remove o token de autenticacao Firebase.' },
      { cmd: '/color', desc: 'Altera a cor do nome da sessao (util com multiplas sessoes).' },
    ],
  },
  {
    category: 'Agentes Vertex',
    items: [
      { cmd: 'Explore', desc: 'Agente rapido para explorar codebases, buscar arquivos e codigo.' },
      { cmd: 'Plan', desc: 'Agente arquiteto para projetar planos de implementacao.' },
      { cmd: 'Worker', desc: 'Agente de trabalho para modo coordenador — executa tarefas autonomamente.' },
    ],
  },
  {
    category: 'Repositorio',
    items: [
      {
        cmd: 'git pull origin main',
        desc: 'Atualiza o Vertex para a versao mais recente (a CLI importa direto do source, entao git pull e suficiente).',
      },
    ],
  },
];

export default function CommandsPage() {
  return (
    <div className="commands-page">
      <h2 className="section-title">Comandos do Vertex</h2>
      <p className="section-subtitle">
        Guia de referencia rapida para usar o Vertex CLI, modos de permissao e configuracoes.
      </p>

      {COMMANDS.map((group) => (
        <div className="cmd-group" key={group.category}>
          <h3 className="cmd-category">{group.category}</h3>
          <div className="cmd-table-wrapper">
            <table className="cmd-table">
              <thead>
                <tr>
                  <th className="cmd-col-cmd">Comando / Variavel</th>
                  <th className="cmd-col-desc">Descricao</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.cmd}>
                    <td className="cmd-cell-cmd">
                      <code>{item.cmd}</code>
                    </td>
                    <td className="cmd-cell-desc">{item.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
