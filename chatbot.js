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

// ===== VARIÁVEIS GLOBAIS =====
let nomeAluno = "";
let nascimentoAluno = "";
let turmaAluno = "";
let responsavelAluno = "";

// Estado dos usuários (fluxos ativos)
const userState = {};

// Funil de mensagens
client.on('message', async msg => {
    try {
        if (!msg.from.endsWith('@c.us')) return; // ignora grupos

        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const rawName = contact.pushname || contact.name || contact.number || '';
        const firstName = (rawName || '').split(' ')[0] || 'Responsável';
        const from = msg.from;
        const body = msg.body.trim();

        // ===== MENU PRINCIPAL =====
        if (/(opção|opcao|menu|oi|olá|ola|dia|tarde|noite)/i.test(body)) {
            try { await chat.sendStateTyping(); } catch {}
            await delay(1200);

            if (!isHorarioComercial()) {
                await client.sendMessage(
                    from,
                    '⚠️ AVISO: O nosso horário de atendimento é de 7h às 17h, de segunda a sexta-feira.\n' +
                    'Agradecemos sua mensagem 💬. Nossa equipe responderá assim que possível, dentro do horário de atendimento.'
                );
                return;
            }

            await client.sendMessage(
                from,
                '👋 Olá, ' + firstName + '! Sou *S.A.M.I.A*, assistente virtual da *EMEIF Mª Amélia Pontes*.\n\n' +
                '⚠️ AVISO: ESTE CANAL É SOMENTE PARA SERVIÇOS EM PDF.\n\n' +
                'Como posso ajudá-lo(a) hoje? Abaixo digite apenas o número da opção desejada:\n\n' +
                '1️⃣ - Pedido de Transferência\n' +
                '2️⃣ - Transferência (Histórico Escolar ano atual)\n' +
                '3️⃣ - Transferência de Anos Anteriores\n' +
                '4️⃣ - Declarações'
            );
            return;
        }

        // ===== OPÇÃO 1 - Pedido de Transferência =====
        if (body === '1') {
            userState[from] = { step: 'pedido_transferencia_nome' };
            await client.sendMessage(
                from,
                '📄 Você escolheu *Pedido de Transferência*.\n\n' +
                'Por favor, informe o *nome completo do aluno*:'
            );
            return;
        }

        // Passo 1 - Nome
        if (userState[from]?.step === 'pedido_transferencia_nome') {
            nomeAluno = body;
            userState[from].step = 'pedido_transferencia_nascimento';

            await client.sendMessage(
                from,
                '✅ Nome registrado.\nAgora, informe a *data de nascimento* do aluno (dd/mm/aaaa):'
            );
            return;
        }

        // Passo 2 - Nascimento
        if (userState[from]?.step === 'pedido_transferencia_nascimento') {
            nascimentoAluno = body;
            userState[from].step = 'pedido_transferencia_turma';

            await client.sendMessage(
                from,
                '📅 Data registrada.\nInforme agora a *turma/ano escolar* do aluno:'
            );
            return;
        }

        // Passo 3 - Turma
        if (userState[from]?.step === 'pedido_transferencia_turma') {
            turmaAluno = body;
            userState[from].step = 'pedido_transferencia_responsavel';

            await client.sendMessage(
                from,
                '📘 Turma registrada.\nPor favor, informe o *nome do responsável pelo aluno*:'
            );
            return;
        }

        // Passo 4 - Responsável (final)
        if (userState[from]?.step === 'pedido_transferencia_responsavel') {
            responsavelAluno = body;

            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${nomeAluno}\n` +
                `🎂 Nascimento: ${nascimentoAluno}\n` +
                `🏫 Turma: ${turmaAluno}\n` +
                `👨‍👩‍👧 Responsável: ${responsavelAluno}\n\n` +
                '✅ Obrigado! Após a conferência e validação, sua solicitação de *Pedido de Transferência* será respondida o mais breve possível.'
            );

            // Limpa estado do usuário
            delete userState[from];
            return;
        }
        // ===== OPÇÃO 2 - Transferência (Histórico Escolar ano atual) =====
        if (body === '2') {
            userState[from] = { step: 'transferencia_atual_nome' };
            await client.sendMessage(
                from,
                '📄 Você escolheu *Transferência (Histórico Escolar ano atual)*.\n\n' +
                'Por favor, informe o *nome completo do aluno*:'
            );
            return;
        }

        // Passo 1 - Nome
        if (userState[from]?.step === 'transferencia_atual_nome') {
            nomeAluno = body;
            userState[from].step = 'transferencia_atual_nascimento';

            await client.sendMessage(
                from,
                '✅ Nome registrado.\nAgora, informe a *data de nascimento* do aluno (dd/mm/aaaa):'
            );
            return;
        }

        // Passo 2 - Data de nascimento
        if (userState[from]?.step === 'transferencia_atual_nascimento') {
            nascimentoAluno = body;
            userState[from].step = 'transferencia_atual_serie';

            await client.sendMessage(
                from,
                '📅 Data registrada.\nPor favor, informe a *série/ano escolar* do aluno:'
            );
            return;
        }

        // Passo 3 - Série/Ano
        if (userState[from]?.step === 'transferencia_atual_serie') {
            turmaAluno = body;
            userState[from].step = 'transferencia_atual_solicitante';

            await client.sendMessage(
                from,
                '📘 Série registrada.\nAgora, informe o *nome do solicitante*:'
            );
            return;
        }

        // Passo 4 - Solicitante
        if (userState[from]?.step === 'transferencia_atual_solicitante') {
            responsavelAluno = body;
            userState[from].step = 'transferencia_atual_parentesco';

            await client.sendMessage(
                from,
                '🙋 Nome do solicitante registrado.\nPor favor, informe o *grau de parentesco* com o aluno (pai, mãe, tio, etc.):'
            );
            return;
        }

        // Passo 5 - Parentesco (final)
        if (userState[from]?.step === 'transferencia_atual_parentesco') {
            const parentesco = body;

            await client.sendMessage(
                from,
                '📌 *Dados recebidos:*\n\n' +
                `👤 Aluno: ${nomeAluno}\n` +
                `🎂 Nascimento: ${nascimentoAluno}\n` +
                `🏫 Série/Ano: ${turmaAluno}\n` +
                `🙋 Solicitante: ${responsavelAluno}\n` +
                `👨‍👩‍👧 Parentesco: ${parentesco}\n\n` +
                '✅ Obrigado! Após a conferência e validação, sua solicitação de *Transferência (Histórico Escolar ano atual)* será respondida o mais breve possível.'
            );

            // Limpa estado do usuário
            delete userState[from];
            return;
        }

        // ===== OPÇÃO 3 - Transferência de Anos Anteriores =====
if (body === '3') {
    userState[from] = { step: 'transferencia_anteriores_nome' };
    await client.sendMessage(
        from,
        '📄 Você escolheu *Transferência de Anos Anteriores*.\n\n' +
        'Por favor, informe o *nome completo do aluno*:'
    );
    return;
}

// Passo 1 - Nome do aluno
if (userState[from]?.step === 'transferencia_anteriores_nome') {
    nomeAluno = body;
    userState[from].step = 'transferencia_anteriores_ano';

    await client.sendMessage(
        from,
        '✅ Nome registrado.\nAgora, informe o *ano de conclusão* do aluno:'
    );
    return;
}

// Passo 2 - Ano de conclusão (final)
if (userState[from]?.step === 'transferencia_anteriores_ano') {
    const anoConclusao = body;

    await client.sendMessage(
        from,
        '📌 *Dados recebidos:*\n\n' +
        `👤 Aluno: ${nomeAluno}\n` +
        `📚 Ano de conclusão: ${anoConclusao}\n\n` +
        '✅ Obrigado! Após a conferência e validação, sua solicitação de *Transferência de Anos Anteriores* será respondida o mais breve possível.'
    );

    // Limpa estado do usuário
    delete userState[from];
    return;
}

// ===== OPÇÃO 4 - Declarações =====
if (body === '4') {
    userState[from] = { step: 'declaracoes_tipo' };
    await client.sendMessage(
        from,
        '📑 Você escolheu *Declarações*.\n\n' +
        'Digite o número da declaração desejada:\n' +
        'A - Matrícula\n' +
        'B - Bolsa Família\n' +
        'C - Emprego/Estágio\n' +
        'D - Carteira de Estudante\n' +
        'E - Curso/Isenção\n' +
        'F - Outra (especifique)\n\n'
    );
    return;
}

// Passo 1 - Tipo de declaração
if (userState[from]?.step === 'declaracoes_tipo') {
    const tipoDeclaracao = body;
    userState[from].tipoDeclaracao = tipoDeclaracao;
    userState[from].step = 'declaracoes_nome_aluno';

    await client.sendMessage(
        from,
        '✅ Tipo de declaração registrado.\nPor favor, informe o *nome completo do aluno*:'
    );
    return;
}

// Passo 2 - Nome do aluno
if (userState[from]?.step === 'declaracoes_nome_aluno') {
    nomeAluno = body;
    userState[from].step = 'declaracoes_ano';

    await client.sendMessage(
        from,
        '✅ Nome registrado.\nAgora, informe a série do aluno:'
    );
    return;
}

// Passo 3 - Ano de conclusão (final)
if (userState[from]?.step === 'declaracoes_ano') {
    const anoConclusao = body;

    // Define o tipo da declaração em texto
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
        `👤 Aluno: ${nomeAluno}\n` +
        `🎓 Série: ${anoConclusao}\n\n` +
        '✅ Obrigado! Sua solicitação de *Declaração* será respondida o mais breve possível.'
    );

    // Limpa estado do usuário
    delete userState[from];
    return;
}





    } catch (err) {
        console.error('❌ Erro no handler:', err);
    }
});




        

        
        // OPÇÃO 2 - Transferência (Histórico Escolar ano atual)
        // if (msg.body === '2') {
        //     try { await chat.sendStateTyping(); } catch {}
        //     await delay(1000);

        //     await client.sendMessage(
        //         msg.from, '📄 Você escolheu *Transferência (Histórico Escolar ano atual).\n\n' + Mpadrao
        //     );

            

        //     return;

        // }

        //  // OPÇÃO 3 - Transferência (Histórico Escolar ano atual)
        // if (msg.body === '3') {
        //     try { await chat.sendStateTyping(); } catch {}
        //     await delay(1000);

        //     const MtranfAnt = 'Digite seu nome como está no RG(carteira de identidade) e o ano que você se formou'

        //     await client.sendMessage(
        //         msg.from, '📄 Você escolheu *Transferência de Anos Anteriores.\n\n' + MtranfAnt
        //     );
        //     return;
            
        // }

        // // OPÇÃO 4 - declaração
        // if (msg.body === '4') {
        //     try { await chat.sendStateTyping(); } catch {}
        //     await delay(1000);

        //     await client.sendMessage(
        //         msg.from,
        //         '📑 Você escolheu *Declarações*.\n\n' +
        //         'Digite o número da declaração desejada:\n' +
        //         '1 - Matrícula\n' +
        //         '2 - Bolsa Família\n' +
        //         '3 - Emprego/Estágio\n' +
        //         '4 - Carteira de Estudante\n' +
        //         '5 - Curso/Isenção\n' +
        //         '6 - Outra (especifique)\n\n'
        //     );
        //     return;
        // }

        // Condição FINAL para mensagem de agradecimento
        // if (
        //     msg.body.length > 5 && // Mensagem com pelo menos 5 caracteres (para não responder a 'oi')
        //     !/(opção|opcao|menu|oi|olá|ola|dia|tarde|noite|1|2|3|4)/i.test(msg.body) // Não é uma das opções principais
        // ) {
        //     try { await chat.sendStateTyping(); } catch {}
        //     await delay(1000);

        //     await client.sendMessage(
        //         msg.from,
        //         'Obrigado pelas informações, após a conferência e validação de seus dados sua solicitação será respondida o mais breve possível. Obrigado.'
        //     );
        //     return;
        // }

