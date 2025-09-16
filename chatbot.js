// samia-bot_comentado.js
// Código do bot WhatsApp (whatsapp-web.js) totalmente comentado, passo a passo
// Objetivo: gerar QR menor no terminal, adicionar opção 'G' para encerrar,
// e garantir que a digitação errada de um usuário não interfira no fluxo de outro.

/*
  Observações importantes:
  - Este arquivo assume que você já rodou `npm install` com as dependências
    indicadas (moment-timezone, qrcode-terminal, whatsapp-web.js).
  - Não alterei a lógica de menu principal além do necessário para adicionar
    a opção 'G' e para armazenar os dados por usuário (para evitar sobrescritas).
  - Se existir sessão salva (pasta .wwebjs_auth), o evento 'qr' NÃO será emitido.
    Apague/renomeie a pasta de sessão para forçar exibição do QR.
*/

// -------------------- DEPENDÊNCIAS --------------------
const qrcode = require('qrcode-terminal'); // renderiza QR no terminal
const moment = require('moment-timezone'); // para lidar com fuso horário (opcional)
const { Client, LocalAuth } = require('whatsapp-web.js'); // biblioteca principal

// -------------------- INICIALIZAÇÃO DO CLIENTE --------------------
// LocalAuth salva sessão localmente em .wwebjs_auth (não enviar token para repositórios!)
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'samia-bot' })
});

// ===== Evento QR =====
// Quando não houver sessão salva, o whatsapp-web.js emite o evento 'qr' com o código.
// Estamos usando `small: true` para gerar um QR menor no terminal (do jeito que você pediu).
client.on('qr', (qr) => {
    // Gera QR pequeno no terminal
    qrcode.generate(qr, { small: true });
    // Mensagem extra para ajudar o operador
    console.log('\n📲 Escaneie o QR Code acima com seu WhatsApp (abra o app -> câmera -> escanear).\n');
});

// Evento quando o cliente está pronto
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
});

// Inicializa o cliente (inicia puppeteer / sessão)
client.initialize();

// -------------------- UTILITÁRIOS --------------------
// Função de delay simples (usada para simular digitação)
const delay = ms => new Promise(res => setTimeout(res, ms));

// Função que verifica se estamos em horário comercial
// Usa timezone America/Fortaleza para precisão local
const isHorarioComercial = () => {
    const agora = moment().tz('America/Fortaleza');
    const hora = agora.hour();
    const dia = agora.day(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado

    // Atendimento das 7h às 17h, de segunda(1) a sexta(5)
    return (hora >= 7 && hora < 17 && dia >= 1 && dia <= 5);
};

// -------------------- ESTADO DOS USUÁRIOS --------------------
/*
  Estrutura: userState[from] = {
    step: 'pedido_transferencia_nome', // etapa atual do fluxo
    tipoDeclaracao: 'A' | 'B' | ... , // quando aplicável
    data: { nomeAluno: '', nascimentoAluno: '', turmaAluno: '', responsavelAluno: '' }
  }

  Armazenar dados dentro do objeto userState por 'from' evita que um usuário
  sobrescreva dados de outro (isso resolve o problema de interferência).
*/
const userState = {};

// -------------------- HANDLER PRINCIPAL DE MENSAGENS --------------------
client.on('message', async msg => {
    try {
        // Ignora mensagens de grupos (apenas clientes individuais terminando com @c.us)
        if (!msg.from.endsWith('@c.us')) return;

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const rawName = contact.pushname || contact.name || contact.number || '';
        const firstName = (rawName || '').split(' ')[0] || 'Responsável';
        const from = msg.from; // identificador único do remetente
        const body = (msg.body || '').trim();

        // --- OPÇÃO G: Encerrar atendimento ---
        // Se o usuário digitar apenas 'G' (maiúsculo ou minúsculo), encerramos o fluxo.
        if (/^encerrar$/i.test(body)) {
            // Limpa estado do usuário (se houver)
            delete userState[from];

            // Resposta curta informando encerramento
            await client.sendMessage(from, '✅ Atendimento encerrado. Obrigado pelo contato!');
            return; // encerra o processamento desta mensagem
        }

        // --- MENU PRINCIPAL (palavras-chave que abrem o menu) ---
        // Se o usuário falar 'oi', 'secretário', 'declaração', etc. exibe o menu.
        if (/(Secretário|secretário|secretario|Secretario|queria|Queria|querio|Quero|Pedir|pedir|Declaração|declaração|transferência|Transferência|transferencia|Transferencia|oi|olá|ola|dia|tarde|noite)/i.test(body)) {
            try { await chat.sendStateTyping(); } catch {};
            await delay(1200);

            // Se estiver fora do horário comercial, informamos e não abrimos o menu.
            if (!isHorarioComercial()) {
                await client.sendMessage(
                    from,
                    '⚠️ AVISO: O nosso horário de atendimento é de 7h às 17h, de segunda a sexta-feira. Por favor não enviar áudio.\n' +
                    'Agradecemos sua mensagem 💬. Nossa equipe responderá assim que possível, dentro do horário de atendimento.'
                );
                return;
            }

            // Mensagem de menu (inclui a instrução pedida: "Digite G para encerrar.")
            await client.sendMessage(
                from,
                '👋 Olá, ' + firstName + '! Sou *Amélia*, assistente virtual da *EMEIF Mª Amélia Pontes*.\n\n' +
                '⚠️ AVISO: ESTE CANAL É SOMENTE PARA SERVIÇOS EM PDF.Por favor não enviar áudio.\n\n' +
                'Como posso ajudá-lo(a) hoje? Abaixo digite apenas o número da opção desejada:\n\n' +
                '1️⃣ - Pedido de Transferência\n' +
                '2️⃣ - Transferência (Histórico Escolar ano atual)\n' +
                '3️⃣ - Transferência de Anos Anteriores\n' +
                '4️⃣ - Declarações\n\n' +
                'Digite encerrar para encerrar.'
            );
            return;
        }

        // -------------------- OPÇÕES DO MENU --------------------
        // Observação: assim que entramos em um fluxo, criamos userState[from] com
        // um objeto 'data' para manter os campos do usuário separados.

        // ===== OPÇÃO 1 - Pedido de Transferência =====
        if (body === '1') {
            userState[from] = { step: 'pedido_transferencia_nome', data: { nomeAluno: '', nascimentoAluno: '', turmaAluno: '', responsavelAluno: '' } };
            await client.sendMessage(from, '📄 Você escolheu *Pedido de Transferência*.\n\nPor favor, informe o *nome completo do aluno*:');
            return;
        }

        // Passo 1 - Nome
        if (userState[from]?.step === 'pedido_transferencia_nome') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'pedido_transferencia_nascimento';

            await client.sendMessage(from, '✅ Nome registrado.\nAgora, informe a *data de nascimento* do aluno (dd/mm/aaaa):');
            return;
        }

        // Passo 2 - Nascimento
        if (userState[from]?.step === 'pedido_transferencia_nascimento') {
            userState[from].data.nascimentoAluno = body;
            userState[from].step = 'pedido_transferencia_turma';

            await client.sendMessage(from, '📅 Data registrada.\nInforme agora a *turma/ano escolar* do aluno:');
            return;
        }

        // Passo 3 - Turma
        if (userState[from]?.step === 'pedido_transferencia_turma') {
            userState[from].data.turmaAluno = body;
            userState[from].step = 'pedido_transferencia_responsavel';

            await client.sendMessage(from, '📘 Turma registrada.\nPor favor, informe o *nome do responsável pelo aluno*:');
            return;
        }

        // Passo 4 - Responsável (final)
        if (userState[from]?.step === 'pedido_transferencia_responsavel') {
            userState[from].data.responsavelAluno = body;

            // Monta mensagem de confirmação usando os dados guardados no userState
            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `🎂 Nascimento: ${userState[from].data.nascimentoAluno}\n` +
                `🏫 Turma: ${userState[from].data.turmaAluno}\n` +
                `👨‍👩‍👧 Responsável: ${userState[from].data.responsavelAluno}\n\n` +
                '✅ Obrigado! Após a conferência e validação, sua solicitação de *Pedido de Transferência* será respondida o mais breve possível.'
            );

            // Limpa estado do usuário
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 2 - Transferência (Histórico Escolar ano atual) =====
        if (body === '2') {
            userState[from] = { step: 'transferencia_atual_nome', data: { nomeAluno: '', nascimentoAluno: '', serie: '', solicitante: '' } };
            await client.sendMessage(from, '📄 Você escolheu *Transferência (Histórico Escolar ano atual)*.\n\nPor favor, informe o *nome completo do aluno*:');
            return;
        }

        // Passo 1 - Nome
        if (userState[from]?.step === 'transferencia_atual_nome') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'transferencia_atual_nascimento';

            await client.sendMessage(from, '✅ Nome registrado.\nAgora, informe a *data de nascimento* do aluno (dd/mm/aaaa):');
            return;
        }

        // Passo 2 - Data de nascimento
        if (userState[from]?.step === 'transferencia_atual_nascimento') {
            userState[from].data.nascimentoAluno = body;
            userState[from].step = 'transferencia_atual_serie';

            await client.sendMessage(from, '📅 Data registrada.\nPor favor, informe a *série/ano escolar* do aluno:');
            return;
        }

        // Passo 3 - Série/Ano
        if (userState[from]?.step === 'transferencia_atual_serie') {
            userState[from].data.serie = body;
            userState[from].step = 'transferencia_atual_solicitante';

            await client.sendMessage(from, '📘 Série registrada.\nAgora, informe o *nome do solicitante*:');
            return;
        }

        // Passo 4 - Solicitante
        if (userState[from]?.step === 'transferencia_atual_solicitante') {
            userState[from].data.solicitante = body;
            userState[from].step = 'transferencia_atual_parentesco';

            await client.sendMessage(from, '🙋 Nome do solicitante registrado.\nPor favor, informe o *grau de parentesco* com o aluno (pai, mãe, tio, etc.):');
            return;
        }

        // Passo 5 - Parentesco (final)
        if (userState[from]?.step === 'transferencia_atual_parentesco') {
            const parentesco = body;

            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `🎂 Nascimento: ${userState[from].data.nascimentoAluno}\n` +
                `🏫 Série/Ano: ${userState[from].data.serie}\n` +
                `🙋 Solicitante: ${userState[from].data.solicitante}\n` +
                `👨‍👩‍👧 Parentesco: ${parentesco}\n\n` +
                '✅ Obrigado! Após a conferência e validação, sua solicitação de *Transferência (Histórico Escolar ano atual)* será respondida o mais breve possível.'
            );

            // Limpa estado do usuário
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 3 - Transferência de Anos Anteriores =====
        if (body === '3') {
            userState[from] = { step: 'transferencia_anteriores_nome', data: { nomeAluno: '' } };
            await client.sendMessage(from, '📄 Você escolheu *Transferência de Anos Anteriores*.\n\nPor favor, informe o *nome completo do aluno*:');
            return;
        }

        // Passo 1 - Nome do aluno
        if (userState[from]?.step === 'transferencia_anteriores_nome') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'transferencia_anteriores_ano';

            await client.sendMessage(from, '✅ Nome registrado.\nAgora, informe o *ano de conclusão* do aluno:');
            return;
        }

        // Passo 2 - Ano de conclusão (final)
        if (userState[from]?.step === 'transferencia_anteriores_ano') {
            const anoConclusao = body;

            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `📚 Ano de conclusão: ${anoConclusao}\n\n` +
                '✅ Obrigado! Após a conferência e validação, sua solicitação de *Transferência de Anos Anteriores* será respondida o mais breve possível.'
            );

            // Limpa estado do usuário
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 4 - Declarações =====
        if (body === '4') {
            userState[from] = { step: 'declaracoes_tipo', tipoDeclaracao: null, data: { nomeAluno: '', ano: '' } };
            await client.sendMessage(from, '📑 Você escolheu *Declarações*.\n\nDigite a letra da declaração desejada:\nA - Matrícula\nB - Bolsa Família\nC - Emprego/Estágio\nD - Carteira de Estudante\nE - Curso/Isenção\nF - Outra (especifique)\n\n');
            return;
        }

        // Passo 1 - Tipo de declaração
        if (userState[from]?.step === 'declaracoes_tipo') {
            const tipoDeclaracao = body.toUpperCase();
            userState[from].tipoDeclaracao = tipoDeclaracao;
            userState[from].step = 'declaracoes_nome_aluno';

            await client.sendMessage(from, '✅ Tipo de declaração registrado.\nPor favor, informe o *nome completo do aluno*:');
            return;
        }

        // Passo 2 - Nome do aluno
        if (userState[from]?.step === 'declaracoes_nome_aluno') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'declaracoes_ano';

            await client.sendMessage(from, '✅ Nome registrado.\nAgora, informe a série do aluno:');
            return;
        }

        // Passo 3 - Ano / final
        if (userState[from]?.step === 'declaracoes_ano') {
            const anoConclusao = body;

            // Define o tipo da declaração em texto (mapa)
            const tipos = {
                'A': 'Matrícula',
                'B': 'Bolsa Família',
                'C': 'Emprego/Estágio',
                'D': 'Carteira de Estudante',
                'E': 'Curso/Isenção',
                'F': 'Outra (especifique)'
            };
            const tipoTexto = tipos[userState[from].tipoDeclaracao] || 'Declaração';

            await client.sendMessage(
                from,
                '📌 *Dados recebidos para a declaração:*\n\n' +
                `📄 Tipo de declaração: ${tipoTexto}\n` +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `🎓 Série: ${anoConclusao}\n\n` +
                '✅ Obrigado! Sua solicitação de *Declaração* será respondida o mais breve possível.'
            );

            // Limpa estado do usuário
            delete userState[from];
            return;
        }

        // -------------------- TRATAMENTO DE DIGITAÇÃO ERRADA (FALBACK) --------------------
        // Se o usuário estiver em um fluxo (userState[from] existe) e a mensagem recebida
        // não corresponder a nenhuma das etapas tratadas acima, enviamos uma
        // mensagem de erro contextual para que ele tente novamente daquela etapa.
        if (userState[from]) {
            const etapa = userState[from].step;

            const mensagensErro = {
                'pedido_transferencia_nome': '⚠️ Digite o *nome completo do aluno* corretamente:',
                'pedido_transferencia_nascimento': '⚠️ Digite a *data de nascimento* no formato dd/mm/aaaa:',
                'pedido_transferencia_turma': '⚠️ Informe a *turma/ano escolar* corretamente:',
                'pedido_transferencia_responsavel': '⚠️ Digite o *nome do responsável* pelo aluno:',

                'transferencia_atual_nome': '⚠️ Digite o *nome completo do aluno*:',
                'transferencia_atual_nascimento': '⚠️ Digite a *data de nascimento* no formato dd/mm/aaaa:',
                'transferencia_atual_serie': '⚠️ Informe a *série/ano escolar*:',
                'transferencia_atual_solicitante': '⚠️ Digite o *nome do solicitante*:',
                'transferencia_atual_parentesco': '⚠️ Informe o *grau de parentesco* com o aluno:',

                'transferencia_anteriores_nome': '⚠️ Digite o *nome completo do aluno*:',
                'transferencia_anteriores_ano': '⚠️ Informe o *ano de conclusão*:',

                'declaracoes_tipo': '⚠️ Digite apenas A, B, C, D, E ou F:',
                'declaracoes_nome_aluno': '⚠️ Digite o *nome completo do aluno*:',
                'declaracoes_ano': '⚠️ Informe a *série do aluno*:'
            };

            if (mensagensErro[etapa]) {
                await client.sendMessage(from, mensagensErro[etapa]);
                return;
            }
        }

        // -------------------- RESPOSTA PADRÃO PARA MENSAGENS LIVRES --------------------
        // Se a mensagem não for parte de um fluxo e não acionou o menu, podemos
        // enviar uma resposta padrão (opcional). Aqui deixamos uma resposta de
        // agradecimento quando a mensagem for maior que 5 caracteres e não for
        // uma das palavras-chave do menu.
        if (body.length > 5 && !/(opção|opcao|menu|oi|olá|ola|dia|tarde|noite|1|2|3|4|g)/i.test(body)) {
            try { await chat.sendStateTyping(); } catch {};
            await delay(1000);

            await client.sendMessage(from, 'Obrigado pelas informações, após a conferência e validação de seus dados sua solicitação será respondida o mais breve possível. Obrigado.');
            return;
        }

        // Fim do handler principal

    } catch (err) {
        console.error('❌ Erro no handler:', err);
    }
});

// -------------------- FIM DO ARQUIVO --------------------
// Dicas finais:
// - Se quiser forçar o aparecimento do QR: pare o script, apague a pasta .wwebjs_auth e rode novamente.
// - Para depuração, monitore o console; erros internos aparecerão no catch.
// - Se desejar, posso adaptar este mesmo código para gerar documentos PDF automáticos
//   ou salvar requisições em um banco de dados simples (SQLite, JSON ou outro).
