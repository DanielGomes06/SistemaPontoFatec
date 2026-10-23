import React, { useState, useEffect, useRef } from 'react';
import {
  Usb,
  Users,
  History,
  KeyRound,
  Unlock,
  CheckCircle2,
  XCircle,
  Clock,
  GraduationCap,
  Trash2,
  UserPlus
} from 'lucide-react';

// Normaliza o UID para comparação: "a1:b2 c3-d4" -> "A1B2C3D4"
const normalizeUid = (uid) => uid.toUpperCase().replace(/[^0-9A-F]/g, '');

export default function App() {
  // Estado da Conexão Serial
  const [isConnected, setIsConnected] = useState(false);
  const [serialLog, setSerialLog] = useState([]);

  // Base de Dados Simulada (Crachás Autorizados)
  const [authorizedUsers, setAuthorizedUsers] = useState([
    { id: '1', name: 'Prof. Carlos Eduardo', role: 'Docente', uid: '01 02 03 04', status: 'Ativo' },
    { id: '2', name: 'Ana Silva', role: 'Aluno - DSM', uid: 'A1 B2 C3 D4', status: 'Ativo' },
    { id: '3', name: 'Marcos Souza', role: 'Administrativo', uid: 'FE 12 89 00', status: 'Ativo' }
  ]);

  // Logs de Acesso
  const [accessLogs, setAccessLogs] = useState([]);

  // Estado do Form de Cadastro de Usuários
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Aluno - DSM');
  const [newUid, setNewUid] = useState('');

  // Referências da conexão Serial
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const readLoopRef = useRef(null);
  const closingRef = useRef(false);

  // Mantém sempre a lista de usuários mais recente acessível ao loop de leitura.
  // (Sem isso, o loop serial enxergaria apenas a lista do momento da conexão.)
  const usersRef = useRef(authorizedUsers);
  useEffect(() => {
    usersRef.current = authorizedUsers;
  }, [authorizedUsers]);

  // Encerra a conexão ao sair da página
  useEffect(() => {
    return () => {
      closingRef.current = true;
      readerRef.current?.cancel().catch(() => {});
    };
  }, []);

  // Monitora mensagens e valida acessos
  const handleSerialData = (dataLine) => {
    const cleanLine = dataLine.trim();
    if (!cleanLine) return;

    setSerialLog((prev) => [
      { time: new Date().toLocaleTimeString('pt-BR'), text: cleanLine },
      ...prev.slice(0, 49)
    ]);

    // Quando o ESP32 envia "UID_LIDA:<UID>"
    if (cleanLine.startsWith('UID_LIDA:')) {
      const uid = cleanLine.replace('UID_LIDA:', '').trim();
      validateAndRespondAccess(uid);
    }
  };

  // Validação no React + Envio do comando de volta ao ESP32
  const validateAndRespondAccess = (uid) => {
    const matchedUser = usersRef.current.find(
      (user) => normalizeUid(user.uid) === normalizeUid(uid) && user.status === 'Ativo'
    );

    const now = new Date();
    const formattedTime = now.toLocaleTimeString('pt-BR');
    const formattedDate = now.toLocaleDateString('pt-BR');

    if (matchedUser) {
      // Registrar log positivo
      const newLog = {
        id: `${Date.now()}-${Math.random()}`,
        name: matchedUser.name,
        role: matchedUser.role,
        uid: uid,
        timestamp: `${formattedDate} ${formattedTime}`,
        authorized: true
      };
      setAccessLogs((prev) => [newLog, ...prev]);

      // Enviar comando para abrir catraca no ESP32
      sendSerialCommand('OPEN\n');
    } else {
      // Registrar log negativo
      const newLog = {
        id: `${Date.now()}-${Math.random()}`,
        name: 'Não Cadastrado',
        role: 'Desconhecido',
        uid: uid,
        timestamp: `${formattedDate} ${formattedTime}`,
        authorized: false
      };
      setAccessLogs((prev) => [newLog, ...prev]);

      // Enviar comando para negar no ESP32
      sendSerialCommand('DENY\n');
    }
  };

  // Libera writer e porta (usado ao desconectar ou se o cabo for removido)
  const releasePort = async () => {
    try {
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch (err) {
      console.error('Erro ao fechar a porta serial:', err);
    } finally {
      portRef.current = null;
      setIsConnected(false);
    }
  };

  // Conectar com o ESP32 usando a Web Serial API
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert('Navegador sem suporte para Web Serial API. Utilize o Google Chrome, Microsoft Edge ou Brave.');
      return;
    }

    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });

      closingRef.current = false;
      portRef.current = selectedPort;
      // Um único writer reutilizado em todos os envios
      writerRef.current = selectedPort.writable.getWriter();
      setIsConnected(true);

      readLoopRef.current = readSerialData(selectedPort).then(async () => {
        // Se o loop terminou sem o usuário pedir (ex.: cabo USB removido), limpa o estado
        if (!closingRef.current && portRef.current === selectedPort) {
          await releasePort();
        }
      });
    } catch (err) {
      console.error('Erro na conexão Serial:', err);
    }
  };

  // Desconectar Serial
  const disconnectSerial = async () => {
    closingRef.current = true;
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      // Aguarda o loop de leitura soltar o lock da porta antes de fechá-la
      await readLoopRef.current;
    } catch (err) {
      console.error('Erro ao cancelar leitura:', err);
    }
    await releasePort();
  };

  // Loop contínuo de leitura
  const readSerialData = async (activePort) => {
    const reader = activePort.readable.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Mantém o pedaço incompleto na linha
          lines.forEach((line) => handleSerialData(line));
        }
      }
    } catch (error) {
      console.error('Erro ao ler dados seriais:', error);
    } finally {
      reader.releaseLock();
      readerRef.current = null;
    }
  };

  // Enviar comando String para o ESP32
  const sendSerialCommand = async (command) => {
    if (!writerRef.current) return;
    try {
      await writerRef.current.write(new TextEncoder().encode(command));
    } catch (err) {
      console.error('Erro ao enviar comando serial:', err);
    }
  };

  // Adicionar novo usuário
  const handleAddUser = (e) => {
    e.preventDefault();
    if (!newName || !newUid) return;

    const newUser = {
      id: Date.now().toString(),
      name: newName,
      role: newRole,
      uid: newUid.toUpperCase().trim(),
      status: 'Ativo'
    };

    setAuthorizedUsers((prev) => [...prev, newUser]);
    setNewName('');
    setNewUid('');
  };

  // Remover usuário
  const handleRemoveUser = (id) => {
    setAuthorizedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col font-sans">
      {/* HEADER FATEC ITAPIRA */}
      <header className="bg-red-800 text-white shadow-md border-b-4 border-red-950">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <GraduationCap className="w-8 h-8 text-red-800" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">FATEC Itapira</h1>
              <p className="text-xs text-red-100 font-medium">
                Ogari de Castro Pacheco • Controle de Acesso RFID
              </p>
            </div>
          </div>

          {/* Status e Botão da Serial */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isConnected ? 'bg-emerald-600 text-white' : 'bg-red-900 text-red-100'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-300 animate-pulse' : 'bg-red-400'}`}></span>
              {isConnected ? 'ESP32 Conectado' : 'ESP32 Desconectado'}
            </div>

            {!isConnected ? (
              <button
                onClick={connectSerial}
                className="flex items-center gap-2 bg-white text-red-800 hover:bg-red-50 px-4 py-2 rounded-md font-semibold text-sm transition shadow-sm"
              >
                <Usb className="w-4 h-4" /> Conectar ESP32
              </button>
            ) : (
              <button
                onClick={disconnectSerial}
                className="flex items-center gap-2 bg-red-950 text-red-200 hover:bg-black px-4 py-2 rounded-md font-semibold text-sm transition"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUNA 1 & 2: PAINEL PRINCIPAL DE LOGS E CONTROLE */}
        <div className="lg:col-span-2 space-y-6">

          {/* CARDS DE AÇÃO RÁPIDA / STATUS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Controle Manual Catraca</p>
                <h3 className="text-lg font-bold text-gray-800 mt-1">Abertura Remota</h3>
              </div>
              <button
                onClick={() => sendSerialCommand('OPEN\n')}
                disabled={!isConnected}
                className="bg-red-800 hover:bg-red-900 disabled:opacity-50 text-white p-3 rounded-lg shadow transition flex items-center gap-2 text-sm font-semibold"
              >
                <Unlock className="w-5 h-5" /> Liberar Catraca
              </button>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Total de Cadastros</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{authorizedUsers.length} Crachás</h3>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-red-800">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE ACESSOS EM TEMPO REAL */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-red-800" />
                <h2 className="font-bold text-gray-800">Registros de Acesso em Tempo Real</h2>
              </div>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                {accessLogs.length} eventos
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {accessLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Aproxime um crachá no leitor MFRC522 para visualizar as tentativas de acesso aqui.
                </div>
              ) : (
                accessLogs.map((log) => (
                  <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="flex items-center space-x-3">
                      {log.authorized ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{log.name}</p>
                        <p className="text-xs text-gray-500">{log.role} • UID: <span className="font-mono bg-gray-100 px-1 rounded">{log.uid}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        log.authorized ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.authorized ? 'Acesso Liberado' : 'Acesso Negado'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" /> {log.timestamp}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MONITOR SERIAL RAW */}
          <div className="bg-gray-900 text-gray-200 rounded-lg p-4 font-mono text-xs shadow-inner">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-800 text-gray-400">
              <span className="flex items-center gap-1 font-semibold">
                <Usb className="w-4 h-4 text-emerald-400" /> Terminal de Comunicação Serial (ESP32)
              </span>
              <button 
                onClick={() => setSerialLog([])}
                className="hover:text-white transition"
              >
                Limpar
              </button>
            </div>
            <div className="h-28 overflow-y-auto space-y-1">
              {serialLog.length === 0 ? (
                <p className="text-gray-600 italic">Nenhuma mensagem serial recebida...</p>
              ) : (
                serialLog.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-gray-500">[{log.time}]</span>
                    <span className="text-emerald-400">&gt;</span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* COLUNA 3: GERENCIAMENTO DE CRACHÁS E USUÁRIOS */}
        <div className="space-y-6">

          {/* FORMULÁRIO DE CADASTRO DE CRACHÁ */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <UserPlus className="w-5 h-5 text-red-800" />
              <h2 className="font-bold text-gray-800">Cadastrar Novo Crachá</h2>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Roberto Alves"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Categoria / Cargo</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-800 bg-white"
                >
                  <option value="Aluno - DSM">Aluno - DSM</option>
                  <option value="Aluno - GE">Aluno - GE</option>
                  <option value="Aluno - GPI">Aluno - GPI</option>
                  <option value="Docente">Docente</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Visitante">Visitante</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">UID da Tag RFID</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 01 02 03 04"
                  value={newUid}
                  onChange={(e) => setNewUid(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-red-800 hover:bg-red-900 text-white font-semibold py-2 px-4 rounded-md text-sm transition shadow-sm flex justify-center items-center gap-2"
              >
                Cadastrar no Sistema
              </button>
            </form>
          </div>

          {/* LISTA DE USUÁRIOS PERMITIDOS */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">Crachás Autorizados</h3>
              <KeyRound className="w-4 h-4 text-gray-500" />
            </div>

            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {authorizedUsers.map((user) => (
                <div key={user.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition">
                  <div>
                    <p className="font-bold text-xs text-gray-800">{user.name}</p>
                    <p className="text-[11px] text-gray-500">{user.role}</p>
                    <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded text-red-900 font-mono">
                      {user.uid}
                    </code>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="text-gray-400 hover:text-red-600 p-1 transition"
                    title="Remover Acesso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-gray-200 text-gray-600 text-xs text-center py-3 border-t border-gray-300">
        <p>Faculdade de Tecnologia de Itapira - "Ogari de Castro Pacheco"</p>
        <p className="text-[10px] text-gray-500">Desenvolvimento de Software Multiplataforma • Projeto Interdisciplinar</p>
      </footer>
    </div>
  );
}