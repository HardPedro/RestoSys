import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Smartphone, Globe, Download, Printer, Database, Settings as SettingsIcon, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Settings() {
  const { userData } = useAuth();
  const appUrl = window.location.origin;
  const waiterLoginUrl = `${appUrl}/waiter/login`;
  const customerMenuUrl = `${appUrl}/menu`;
  const [printerType, setPrinterType] = useState('80mm');
  const [isGenerating, setIsGenerating] = useState(false);

  // Local Print Agent State
  const [agentStatus, setAgentStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [printers, setPrinters] = useState<string[]>([]);
  const [localConfig, setLocalConfig] = useState({
    cozinha: { printer: '', tipo: 'termica', largura: 80 },
    bar: { printer: '', tipo: 'termica', largura: 58 },
    caixa: { printer: '', tipo: 'normal', largura: 80 }
  });

  useEffect(() => {
    const savedPrinter = localStorage.getItem('printerType');
    if (savedPrinter) {
      setPrinterType(savedPrinter);
    }
    checkAgentStatus();
    const interval = setInterval(checkAgentStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkAgentStatus = async () => {
    try {
      const res = await fetch('http://localhost:17321/health');
      if (res.ok) {
        if (agentStatus !== 'online') {
          setAgentStatus('online');
          fetchPrinters();
        }
      } else {
        setAgentStatus('offline');
      }
    } catch {
      setAgentStatus('offline');
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch('http://localhost:17321/printers');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data);
      }
    } catch (e) {
      console.error('Failed to fetch printers', e);
    }
  };

  const saveLocalConfig = async () => {
    try {
      const res = await fetch('http://localhost:17321/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig)
      });
      if (res.ok) {
        toast.success('Configuração do agente salva com sucesso!');
      } else {
        toast.error('Erro ao salvar configuração no agente.');
      }
    } catch (e) {
      toast.error('Erro de conexão com o agente local.');
    }
  };

  const handlePrinterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPrinterType(val);
    localStorage.setItem('printerType', val);
    toast.success('Configuração de impressora salva neste dispositivo!');
  };

  const generateTestData = async () => {
    setIsGenerating(true);
    toast.info('Gerando dados de teste...');
    try {
      const productsSnap = await getDocs(collection(db, 'products'));
      let products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      if (products.length === 0) {
        const p1 = await addDoc(collection(db, 'products'), { name: 'Hambúrguer Artesanal', price: 35.90, category: 'food', description: 'Pão, carne 180g, queijo' });
        const p2 = await addDoc(collection(db, 'products'), { name: 'Coca-Cola Lata', price: 6.00, category: 'drink', description: '350ml' });
        const p3 = await addDoc(collection(db, 'products'), { name: 'Batata Frita', price: 22.00, category: 'food', description: 'Porção 400g' });
        products = [
          { id: p1.id, name: 'Hambúrguer Artesanal', price: 35.90, category: 'food' },
          { id: p2.id, name: 'Coca-Cola Lata', price: 6.00, category: 'drink' },
          { id: p3.id, name: 'Batata Frita', price: 22.00, category: 'food' }
        ];
      }

      const tablesSnap = await getDocs(collection(db, 'tables'));
      let tables = tablesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const today = new Date();
      const paymentMethods = ['credit', 'debit', 'pix', 'cash'];
      
      for (let i = 0; i < 8; i++) {
        const table = tables[Math.floor(Math.random() * tables.length)];
        const orderDate = new Date(today);
        orderDate.setHours(today.getHours() - Math.floor(Math.random() * 8) - 1);
        
        let orderTotal = 0;
        const itemsToCreate = [];
        
        const numItems = Math.floor(Math.random() * 4) + 2;
        for (let j = 0; j < numItems; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const quantity = Math.floor(Math.random() * 3) + 1;
          orderTotal += product.price * quantity;
          
          itemsToCreate.push({
            productName: product.name,
            price: product.price,
            quantity,
            type: product.category,
            status: 'ready',
            tableNumber: table?.number || 1,
            createdAt: orderDate.toISOString()
          });
        }

        const orderRef = await addDoc(collection(db, 'orders'), {
          tableId: table?.id || 'unknown',
          status: 'closed',
          total: orderTotal,
          createdAt: orderDate.toISOString(),
          closedAt: new Date(orderDate.getTime() + 60*60*1000).toISOString()
        });

        for (const item of itemsToCreate) {
          await addDoc(collection(db, 'orderItems'), {
            ...item,
            orderId: orderRef.id
          });
        }

        await addDoc(collection(db, 'transactions'), {
          type: 'receivable',
          amount: orderTotal,
          description: `Venda Mesa ${table?.number || 1}`,
          status: 'paid',
          dueDate: orderDate.toISOString(),
          paidDate: new Date(orderDate.getTime() + 60*60*1000).toISOString(),
          category: 'sales',
          orderId: orderRef.id,
          paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          createdAt: new Date(orderDate.getTime() + 60*60*1000).toISOString()
        });
      }

      if (tables.length > 0) {
        const activeTable = tables[0];
        const activeOrderRef = await addDoc(collection(db, 'orders'), {
          tableId: activeTable.id,
          status: 'open',
          total: products[0].price * 2,
          createdAt: new Date().toISOString()
        });
        
        await addDoc(collection(db, 'orderItems'), {
          orderId: activeOrderRef.id,
          productName: products[0].name,
          price: products[0].price,
          quantity: 2,
          type: products[0].category,
          status: 'pending',
          tableNumber: activeTable.number,
          createdAt: new Date().toISOString()
        });

        await updateDoc(doc(db, 'tables', activeTable.id), {
          status: 'occupied',
          currentOrderId: activeOrderRef.id
        });
      }

      toast.success('Dados de teste gerados com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar dados de teste');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQR = (id: string, filename: string) => {
    const svg = document.getElementById(id);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `${filename}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-8 text-2xl md:text-3xl font-bold text-zinc-900">Configurações</h1>

      <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-2">
        {/* Waiter QR Code */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Smartphone size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-zinc-900">Acesso Garçom</h2>
              <p className="text-xs md:text-sm text-zinc-500">QR Code para os garçons conectarem seus celulares</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl bg-zinc-50 p-6 md:p-8">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <QRCodeSVG id="waiter-qr" value={waiterLoginUrl} size={180} level="H" includeMargin />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-zinc-600">
              Aponte a câmera para conectar
            </p>
            <code className="mt-2 w-full break-all rounded bg-zinc-200 px-2 py-1 text-center text-[10px] md:text-xs text-zinc-700">
              {waiterLoginUrl}
            </code>
            <button
              onClick={() => downloadQR('waiter-qr', 'qr-acesso-garcom')}
              className="mt-4 flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              <Download size={16} /> Baixar QR Code
            </button>
          </div>
        </div>

        {/* Customer Menu QR Code */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Globe size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-zinc-900">Cardápio Digital</h2>
              <p className="text-xs md:text-sm text-zinc-500">QR Code único para visualização dos clientes</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl bg-zinc-50 p-6 md:p-8">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <QRCodeSVG id="menu-qr" value={customerMenuUrl} size={180} level="H" includeMargin />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-zinc-600">
              Disponibilize nas mesas
            </p>
            <code className="mt-2 w-full break-all rounded bg-zinc-200 px-2 py-1 text-center text-[10px] md:text-xs text-zinc-700">
              {customerMenuUrl}
            </code>
            <button
              onClick={() => downloadQR('menu-qr', 'qr-cardapio-geral')}
              className="mt-4 flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download size={16} /> Baixar QR Code
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <SettingsIcon size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-zinc-900">Agente de Impressão Local</h2>
              <p className="text-xs md:text-sm text-zinc-500">Impressão silenciosa para Cozinha, Bar e Caixa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {agentStatus === 'checking' && <span className="text-sm text-zinc-500">Verificando...</span>}
            {agentStatus === 'online' && <span className="flex items-center gap-1 text-sm font-bold text-green-600"><CheckCircle size={16} /> Online</span>}
            {agentStatus === 'offline' && <span className="flex items-center gap-1 text-sm font-bold text-red-600"><XCircle size={16} /> Offline</span>}
          </div>
        </div>

        {agentStatus === 'offline' && (
          <div className="mb-6 rounded-lg bg-orange-50 p-4 border border-orange-200">
            <p className="text-sm text-orange-800 mb-3">
              O agente local não está rodando. Para habilitar a impressão automática e silenciosa, baixe e execute o agente no computador do caixa.
            </p>
            <a 
              href="/PrintAgent.zip" 
              download
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              <Download size={16} /> Baixar Agente (.zip)
            </a>
          </div>
        )}

        {agentStatus === 'online' && (
          <div className="grid gap-6 md:grid-cols-3">
            {['cozinha', 'bar', 'caixa'].map((setor) => (
              <div key={setor} className="rounded-xl border border-zinc-200 p-4">
                <h3 className="mb-3 font-bold capitalize text-zinc-900">{setor}</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Impressora</label>
                    <select
                      value={localConfig[setor as keyof typeof localConfig].printer}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, [setor]: { ...prev[setor as keyof typeof localConfig], printer: e.target.value } }))}
                      className="w-full rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione...</option>
                      {printers.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Tipo</label>
                    <select
                      value={localConfig[setor as keyof typeof localConfig].tipo}
                      onChange={(e) => setLocalConfig(prev => ({ ...prev, [setor]: { ...prev[setor as keyof typeof localConfig], tipo: e.target.value } }))}
                      className="w-full rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="termica">Térmica</option>
                      <option value="normal">Normal (A4)</option>
                    </select>
                  </div>

                  {localConfig[setor as keyof typeof localConfig].tipo === 'termica' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700">Largura (mm)</label>
                      <select
                        value={localConfig[setor as keyof typeof localConfig].largura}
                        onChange={(e) => setLocalConfig(prev => ({ ...prev, [setor]: { ...prev[setor as keyof typeof localConfig], largura: Number(e.target.value) } }))}
                        className="w-full rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value={80}>80mm</option>
                        <option value={58}>58mm</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {agentStatus === 'online' && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveLocalConfig}
              className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
            >
              Salvar Configurações do Agente
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
            <Printer size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-zinc-900">Impressão do Navegador (Fallback)</h2>
            <p className="text-xs md:text-sm text-zinc-500">Usado caso o Agente Local não esteja disponível</p>
          </div>
        </div>

        
        <div className="max-w-md">
          <label className="mb-2 block text-sm font-medium text-zinc-700">Tamanho da Impressora</label>
          <select 
            value={printerType}
            onChange={handlePrinterChange}
            className="w-full rounded-lg border border-zinc-300 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          >
            <option value="80mm">Bobina Térmica 80mm (Padrão)</option>
            <option value="58mm">Bobina Térmica 58mm (Pequena)</option>
            <option value="a4">Folha A4 (Impressora Comum)</option>
          </select>
          <p className="mt-2 text-xs text-zinc-500">
            Esta configuração afeta apenas as impressões feitas a partir deste navegador.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 md:p-8 shadow-sm">
        <h2 className="mb-4 text-lg md:text-xl font-bold text-zinc-900">Segurança e Regras</h2>
        <div className="space-y-4 text-sm text-zinc-600">
          <p>• Cada garçom deve utilizar seu próprio PIN de acesso.</p>
          <p>• O sistema previne que duas ordens sejam abertas para a mesma mesa simultaneamente.</p>
          <p>• Itens enviados para a cozinha/bar não podem ser excluídos sem autorização do gerente.</p>
        </div>
      </div>

      {userData?.email === 'hardsoldisk001@gmail.com' && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-900">Área do Desenvolvedor</h2>
              <p className="text-sm text-red-700">Visível apenas para {userData.email}</p>
            </div>
          </div>
          
          <p className="mb-4 text-sm text-red-800">
            Utilize esta opção para popular o banco de dados com informações sintéticas (pedidos, vendas, itens pendentes) para testar o Dashboard e os fluxos do sistema.
          </p>
          
          <button
            onClick={generateTestData}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <Database size={20} />
            {isGenerating ? 'Gerando dados...' : 'Gerar Dados Sintéticos'}
          </button>
        </div>
      )}
    </div>
  );
}
