// leitor de qr code
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// Inicializa o cliente e salva sessão local
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'samia-bot' })
});

// Serviço de leitura do QR code
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Mensagem quando conectar
client.on('ready', () => {
    console.log('✅ Tudo certo! WhatsApp conectado.');
});

// Inicializa tudo
client.initialize();

// Função de delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// Função para verificar o horário de funcionamento
const isHorarioComercial = () => {
    const agora = new Date();
    const hora = agora.getHours();
    return hora >= 7 && hora < 17;
};

// Funil de mensagens
client.on('message', async msg => {
    try {
        // Ignorar mensagens de grupos ou status
        if (!msg.from.endsWith('@c.us')) return;

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const rawName = contact.pushname || contact.name || contact.number || '';
        const firstName = (rawName || '').split(' ')[0] || 'Responsável';

        // MENU PRINCIPAL - palavras de ativação
        if (/(opção|opcao|menu|oi|olá|ola|dia|tarde|noite)/i.test(msg.body)) {
            try { await chat.sendStateTyping(); } catch {}
            await delay(1200);

            if (!isHorarioComercial()) {
                await client.sendMessage(
                    msg.from,
                    '⚠️ AVISO: O nosso horário de atendimento é de 7h às 17h, de segunda a sexta-feira.\n' +
                    'Sua mensagem será respondida assim que possível, dentro do nosso horário de funcionamento.'
                );
                return;
            }

            await client.sendMessage(
                msg.from,
                '👋 Olá, ' + firstName + '! Sou *S.A.M.I.A*, assistente virtual da *EMEIF Mª Amélia Pontes*.\n\n' +
                '⚠️ AVISO: ESTE CANAL É SOMENTE PARA SERVIÇOS EM PDF.\n\n' +
                'Como posso ajudá-lo(a) hoje? Digite uma das opções abaixo:\n\n' +
                '1️⃣ - Transferência (Histórico Escolar)\n' +
                '2️⃣ - Declarações'
            );
            return;
        }

        // OPÇÃO 1 - TRANSFERÊNCIA
        if (msg.body === '1') {
            try { await chat.sendStateTyping(); } catch {}
            await delay(1000);

            await client.sendMessage(
                msg.from,
                '📄 Você escolheu *Pedido de Transferência (Histórico Escolar)*.\n\n' +
                'Por favor, informe os dados:\n' +
                '- Nome do aluno\n- Série\n- Nome do solicitante\n- CPF do solicitante\n- Grau de parentesco com o aluno'
            );
            return;
        }
        
        // OPÇÃO 2 - DECLARAÇÕES
        if (msg.body === '2') {
            try { await chat.sendStateTyping(); } catch {}
            await delay(1000);

            await client.sendMessage(
                msg.from,
                '📑 Você escolheu *Declarações*.\n\n' +
                'Digite o número da declaração desejada:\n' +
                '1️⃣ - Matrícula\n' +
                '2️⃣ - Transferência\n' +
                '3️⃣ - Bolsa Família\n' +
                '4️⃣ - Emprego/Estágio\n' +
                '6️⃣ - Carteira de Estudante\n' +
                '7️⃣ - Curso/Isenção\n' +
                '9️⃣ - Outra (especifique)\n\n' +
                '⚠️ Após escolher, informe também:\n' +
                '- Nome do aluno\n- ' +
                'Série\n- ' +
                'Nome do solicitante\n- ' +
                'CPF do solicitante\n- ' +
                'Grau de parentesco com o aluno'
            );
            return;
        }

        // Condição FINAL para mensagem de agradecimento
        if (
            msg.body.length > 5 && // Mensagem com pelo menos 5 caracteres (para não responder a 'oi')
            !/(opção|opcao|menu|oi|olá|ola|dia|tarde|noite|1|2)/i.test(msg.body) // Não é uma das opções principais
        ) {
            try { await chat.sendStateTyping(); } catch {}
            await delay(1000);

            await client.sendMessage(
                msg.from,
                'Obrigado pelas informações, após a conferência sua solicitação será encaminhada e respondida o mais breve possível.'
            );
            return;
        }

    } catch (err) {
        console.error('❌ Erro no handler:', err);
    }
});