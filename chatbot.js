// samia-bot_comentado.js
// Código do bot WhatsApp (whatsapp-web.js) totalmente comentado, passo a passo
// Objetivo: gerar QR menor no terminal, adicionar opção 'encerrar',
// e garantir que a digitação errada de um usuário não interfira no fluxo de outro.

/*
  Observações importantes:
  - Este arquivo assume que você já rodou `npm install` com as dependências
    indicadas (moment-timezone, qrcode-terminal, whatsapp-web.js).
  - Se existir sessão salva (pasta .wwebjs_auth), o evento 'qr' NÃO será emitido.
    Apague/renomeie a pasta de sessão para forçar exibição do QR.
*/

// -------------------- DEPENDÊNCIAS --------------------
const qrcode = require('qrcode-terminal'); // renderiza QR no terminal
const moment = require('moment-timezone'); // para lidar com fuso horário
const { Client, LocalAuth } = require('whatsapp-web.js'); // biblioteca principal

// -------------------- INICIALIZAÇÃO DO CLIENTE --------------------
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'samia-bot' })
});

// Evento QR (gera QR pequeno no terminal)
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n📲 Escaneie o QR Code acima com seu WhatsApp (abra o app -> câmera -> escanear).\n');
});

// Evento quando o cliente está pronto
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
});

// Inicializa o cliente
client.initialize();

// -------------------- UTILITÁRIOS --------------------
const delay = ms => new Promise(res => setTimeout(res, ms));

// Verifica se é horário comercial
const isHorarioComercial = () => {
    const agora = moment().tz('America/Fortaleza');
    const hora = agora.hour();
    const dia = agora.day(); // 0=Domingo, 1=Segunda ... 6=Sábado
    return (hora >= 7 && hora < 17 && dia >= 1 && dia <= 5);
};

// -------------------- ESTADO DOS USUÁRIOS --------------------
/*
  Estrutura: userState[from] = {
    step: 'pedido_transferencia_nome',
    tipoDeclaracao: 'A' | 'B' | ... ,
    data: { nomeAluno: '', nascimentoAluno: '', turmaAluno: '', responsavelAluno: '' }
  }
*/
const userState = {};

// -------------------- HANDLER PRINCIPAL DE MENSAGENS --------------------
client.on('message', async msg => {
    try {
        // Ignora grupos
        if (!msg.from.endsWith('@c.us')) return;

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const rawName = contact.pushname || contact.name || contact.number || '';
        const firstName = (rawName || '').split(' ')[0] || 'Responsável';
        const from = msg.from;
        const body = (msg.body || '').trim();

        // --- OPÇÃO ENCERRAR ---
        if (/^encerrar$/i.test(body)) {
            delete userState[from];
            await client.sendMessage(from, '✅ Atendimento encerrado. Obrigado pelo contato!');
            return;
        }

        // --- MENU PRINCIPAL ---
        if (/(Secretário|secretário|secretario|Secretario|queria|Queria|Quero|pedir|Declaração|declaração|transferência|Transferência|oi|olá|ola|dia|tarde|noite)/i.test(body)) {
            try { await chat.sendStateTyping(); } catch {};
            await delay(1200);

            if (!isHorarioComercial()) {
                await client.sendMessage(
                    from,
                    '⚠️ AVISO: Nosso horário de atendimento é de 7h às 17h, de segunda a sexta-feira.\n' +
                    'Agradecemos sua mensagem 💬. Nossa equipe responderá assim que possível, dentro do horário.'
                );
                return;
            }

            await client.sendMessage(
                from,
                '👋 Olá, ' + firstName + '! Sou *Amélia*, assistente virtual da *EMEIF Mª Amélia Pontes*.\n\n' +
                '⚠️ AVISO: ESTE CANAL É SOMENTE PARA SERVIÇOS EM PDF. Não envie áudios.\n\n' +
                'Como posso ajudá-lo(a)? Digite apenas o número da opção desejada:\n\n' +
                '1️⃣ - Pedido de Transferência\n' +
                '2️⃣ - Transferência (Histórico Escolar ano atual)\n' +
                '3️⃣ - Transferência de Anos Anteriores\n' +
                '4️⃣ - Declarações\n\n' +
                'Digite *encerrar* para encerrar.'
            );
            return;
        }

        // ===== OPÇÃO 1 - Pedido de Transferência =====
        if (body === '1') {
            userState[from] = { step: 'pedido_transferencia_nome', data: { nomeAluno: '', nascimentoAluno: '', turmaAluno: '', responsavelAluno: '' } };
            await client.sendMessage(from, '📄 Você escolheu *Pedido de Transferência*.\n\nInforme o *nome completo do aluno*:');
            return;
        }

        if (userState[from]?.step === 'pedido_transferencia_nome') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'pedido_transferencia_nascimento';
            await client.sendMessage(from, '✅ Nome registrado.\nAgora, informe a *data de nascimento* do aluno (dd/mm/aaaa):');
            return;
        }

        if (userState[from]?.step === 'pedido_transferencia_nascimento') {
            userState[from].data.nascimentoAluno = body;
            userState[from].step = 'pedido_transferencia_turma';
            await client.sendMessage(from, '📅 Data registrada.\nInforme a *turma/ano escolar* do aluno:');
            return;
        }

        if (userState[from]?.step === 'pedido_transferencia_turma') {
            userState[from].data.turmaAluno = body;
            userState[from].step = 'pedido_transferencia_responsavel';
            await client.sendMessage(from, '📘 Turma registrada.\nInforme o *nome do responsável pelo aluno*:');
            return;
        }

        if (userState[from]?.step === 'pedido_transferencia_responsavel') {
            userState[from].data.responsavelAluno = body;
            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `🎂 Nascimento: ${userState[from].data.nascimentoAluno}\n` +
                `🏫 Turma: ${userState[from].data.turmaAluno}\n` +
                `👨‍👩‍👧 Responsável: ${userState[from].data.responsavelAluno}\n\n` +
                '✅ Sua solicitação de *Pedido de Transferência* será respondida o mais breve possível.'
            );
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 2 - Transferência (Histórico Escolar ano atual) =====
        if (body === '2') {
            userState[from] = { step: 'transferencia_atual_nome', data: { nomeAluno: '', nascimentoAluno: '', serie: '', solicitante: '' } };
            await client.sendMessage(from, '📄 Você escolheu *Transferência (Histórico Escolar ano atual)*.\n\nInforme o *nome completo do aluno*:');
            return;
        }

        if (userState[from]?.step === 'transferencia_atual_nome') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'transferencia_atual_nascimento';
            await client.sendMessage(from, '✅ Nome registrado.\nInforme a *data de nascimento* do aluno (dd/mm/aaaa):');
            return;
        }

        if (userState[from]?.step === 'transferencia_atual_nascimento') {
            userState[from].data.nascimentoAluno = body;
            userState[from].step = 'transferencia_atual_serie';
            await client.sendMessage(from, '📅 Data registrada.\nInforme a *série/ano escolar* do aluno:');
            return;
        }

        if (userState[from]?.step === 'transferencia_atual_serie') {
            userState[from].data.serie = body;
            userState[from].step = 'transferencia_atual_solicitante';
            await client.sendMessage(from, '📘 Série registrada.\nInforme o *nome do solicitante*:');
            return;
        }

        if (userState[from]?.step === 'transferencia_atual_solicitante') {
            userState[from].data.solicitante = body;
            userState[from].step = 'transferencia_atual_parentesco';
            await client.sendMessage(from, '🙋 Nome registrado.\nInforme o *grau de parentesco* com o aluno:');
            return;
        }

        if (userState[from]?.step === 'transferencia_atual_parentesco') {
            const parentesco = body;
            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `🎂 Nascimento: ${userState[from].data.nascimentoAluno}\n` +
                `🏫 Série: ${userState[from].data.serie}\n` +
                `🙋 Solicitante: ${userState[from].data.solicitante}\n` +
                `👨‍👩‍👧 Parentesco: ${parentesco}\n\n` +
                '✅ Sua solicitação de *Transferência (Histórico Escolar ano atual)* será respondida o mais breve possível.'
            );
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 3 - Transferência de Anos Anteriores =====
        if (body === '3') {
            userState[from] = { step: 'transferencia_anteriores_nome', data: { nomeAluno: '' } };
            await client.sendMessage(from, '📄 Você escolheu *Transferência de Anos Anteriores*.\n\nInforme o *nome completo do aluno*:');
            return;
        }

        if (userState[from]?.step === 'transferencia_anteriores_nome') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'transferencia_anteriores_ano';
            await client.sendMessage(from, '✅ Nome registrado.\nInforme o *ano de conclusão* do aluno:');
            return;
        }

        if (userState[from]?.step === 'transferencia_anteriores_ano') {
            const anoConclusao = body;
            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `📚 Ano de conclusão: ${anoConclusao}\n\n` +
                '✅ Sua solicitação de *Transferência de Anos Anteriores* será respondida o mais breve possível.'
            );
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 4 - Declarações =====
        if (body === '4') {
            userState[from] = { step: 'declaracoes_tipo', tipoDeclaracao: null, data: { nomeAluno: '', ano: '' } };
            await client.sendMessage(from,
                '📑 Você escolheu *Declarações*.\n\nDigite a letra da declaração desejada:\n' +
                'A - Matrícula\nB - Bolsa Família\nC - Emprego/Estágio\nD - Carteira de Estudante\nE - Curso/Isenção\nF - Outra (especifique)'
            );
            return;
        }

        if (userState[from]?.step === 'declaracoes_tipo') {
            userState[from].tipoDeclaracao = body.toUpperCase();
            userState[from].step = 'declaracoes_nome_aluno';
            await client.sendMessage(from, '✅ Tipo registrado.\nInforme o *nome completo do aluno*:');
            return;
        }

        if (userState[from]?.step === 'declaracoes_nome_aluno') {
            userState[from].data.nomeAluno = body;
            userState[from].step = 'declaracoes_ano';
            await client.sendMessage(from, '✅ Nome registrado.\nInforme a *série do aluno*:');
            return;
        }

        if (userState[from]?.step === 'declaracoes_ano') {
            const serieAluno = body;
            const tipos = {
                'A': 'Matrícula',
                'B': 'Bolsa Família',
                'C': 'Emprego/Estágio',
                'D': 'Carteira de Estudante',
                'E': 'Curso/Isenção',
                'F': 'Outra (especifique no nome do aluno. EX: Nome do aluno - declaração para XXXXXX)'
            };
            const tipoTexto = tipos[userState[from].tipoDeclaracao] || 'Declaração';

            await client.sendMessage(
                from,
                '📌 *Dados recebidos para a declaração:*\n\n' +
                `📄 Tipo: ${tipoTexto}\n` +
                `👤 Aluno: ${userState[from].data.nomeAluno}\n` +
                `🎓 Série: ${serieAluno}\n\n` +
                '✅ Sua solicitação de *Declaração* será respondida o mais breve possível.'
            );
            delete userState[from];
            return;
        }

        // ===== TRATAMENTO DE ERROS DE DIGITAÇÃO =====
        if (userState[from]) {
            const etapa = userState[from].step;
            const mensagensErro = {
                'pedido_transferencia_nome': '⚠️ Digite o *nome completo do aluno*:',
                'pedido_transferencia_nascimento': '⚠️ Digite a *data de nascimento* (dd/mm/aaaa):',
                'pedido_transferencia_turma': '⚠️ Informe a *turma/ano escolar*:',
                'pedido_transferencia_responsavel': '⚠️ Digite o *nome do responsável*:',

                'transferencia_atual_nome': '⚠️ Digite o *nome completo do aluno*:',
                'transferencia_atual_nascimento': '⚠️ Digite a *data de nascimento* (dd/mm/aaaa):',
                'transferencia_atual_serie': '⚠️ Informe a *série/ano escolar*:',
                'transferencia_atual_solicitante': '⚠️ Digite o *nome do solicitante*:',
                'transferencia_atual_parentesco': '⚠️ Informe o *grau de parentesco*:',

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

        // ===== RESPOSTA PADRÃO =====
        if (body.length > 5 && !/(opção|opcao|menu|oi|olá|ola|dia|tarde|noite|1|2|3|4|encerrar)/i.test(body)) {
            try { await chat.sendStateTyping(); } catch {};
            await delay(1000);
            await client.sendMessage(from, 'Obrigado! Após conferência, sua solicitação será respondida em breve.');
            return;
        }

    } catch (err) {
        console.error('❌ Erro no handler:', err);
    }
});

// -------------------- FIM DO ARQUIVO --------------------
