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
                '- Nome do aluno\n- '+
                'Série\n- '+
                'Nome do solicitante\n- '+
                'CPF do solicitante\n- '+
                'Grau de parentesco com o aluno'
            );
            return;
        }

    } catch (err) {
        console.error('❌ Erro no handler:', err);
    }
});
