import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Calculator, CheckCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { printReceipt } from '../../lib/print';

export default function Cashier() {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [autoPrint, setAutoPrint] = useState(true);

  useEffect(() => {
    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a: any, b: any) => a.number - b.number));
    });
    return () => unsubTables();
  }, []);

  const currentTable = tables.find(t => t.id === selectedTable?.id) || null;
  const currentOrderId = currentTable?.currentOrderId;

  useEffect(() => {
    if (currentOrderId) {
      const unsubOrder = onSnapshot(doc(db, 'orders', currentOrderId), (doc) => {
        if (doc.exists()) setCurrentOrder({ id: doc.id, ...doc.data() });
      });
      const q = query(collection(db, 'orderItems'), where('orderId', '==', currentOrderId));
      const unsubItems = onSnapshot(q, (snapshot) => {
        setOrderItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => {
        unsubOrder();
        unsubItems();
      };
    } else {
      setCurrentOrder(null);
      setOrderItems([]);
    }
  }, [currentOrderId]);

  const handlePrint = (isPreBill = false) => {
    if (!currentOrder || !currentTable) return;
    
    const itemsHtml = orderItems.map(item => `
      <div class="flex mb-2">
        <span>${item.quantity}x ${item.productName}</span>
        <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    const paymentMethodNames: Record<string, string> = {
      credit: 'Crédito',
      debit: 'Débito',
      pix: 'Pix',
      cash: 'Dinheiro'
    };

    const content = `
      <div class="text-center border-b">
        <h2>RESTAURANTE EXPRESS</h2>
        <p>${isPreBill ? 'Conferência de Mesa' : 'Cupom Não Fiscal'}</p>
        <p>${new Date().toLocaleString('pt-BR')}</p>
      </div>
      <div class="border-b">
        <p class="bold text-lg">MESA ${currentTable.number}</p>
        <p>Pedido #${currentOrder.id.slice(0, 8)}</p>
      </div>
      <div class="border-b">
        ${itemsHtml}
      </div>
      <div class="flex border-b text-lg bold">
        <span>TOTAL</span>
        <span>R$ ${currentOrder.total.toFixed(2)}</span>
      </div>
      <div class="text-center">
        ${!isPreBill ? `<p>Pagamento: ${paymentMethodNames[paymentMethod] || paymentMethod}</p>` : '<p>Aguardando Pagamento</p>'}
        <p>Obrigado pela preferência!</p>
      </div>
    `;
    printReceipt(content);
    toast.success(isPreBill ? 'Imprimindo pré-conta...' : 'Imprimindo comprovante...');
  };

  const handleCloseOrder = async () => {
    if (!currentTable || !currentOrder) return;
    
    try {
      if (autoPrint) {
        handlePrint(false);
      }

      // 1. Create Transaction
      await addDoc(collection(db, 'transactions'), {
        type: 'receivable',
        amount: currentOrder.total,
        description: `Venda Mesa ${currentTable.number}`,
        status: 'paid',
        dueDate: new Date().toISOString(),
        paidDate: new Date().toISOString(),
        category: 'sales',
        orderId: currentOrder.id,
        paymentMethod,
        createdAt: new Date().toISOString()
      });

      // 2. Close Order
      await updateDoc(doc(db, 'orders', currentOrder.id), {
        status: 'closed',
        closedAt: new Date().toISOString()
      });

      // 3. Free Table
      await updateDoc(doc(db, 'tables', currentTable.id), {
        status: 'free',
        currentOrderId: null
      });

      toast.success('Conta fechada com sucesso!');
      setSelectedTable(null);
    } catch (error) {
      toast.error('Erro ao fechar conta');
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Tables List */}
      <div className="w-1/3 border-r bg-white p-6 overflow-y-auto">
        <h2 className="mb-6 text-2xl font-bold text-zinc-900">Caixa</h2>
        <div className="space-y-3">
          {tables.filter(t => t.status !== 'free').map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`flex w-full items-center justify-between rounded-xl border p-4 transition-colors ${
                selectedTable?.id === table.id ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${
                  table.status === 'billing' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {table.number}
                </div>
                <span className="font-medium text-zinc-900">Mesa {table.number}</span>
              </div>
              {table.status === 'billing' && (
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-600">Fechando</span>
              )}
            </button>
          ))}
          {tables.filter(t => t.status !== 'free').length === 0 && (
            <p className="text-center text-zinc-500 mt-10">Nenhuma mesa ocupada no momento.</p>
          )}
        </div>
      </div>

      {/* Order Details */}
      <div className="flex-1 p-8">
        {currentTable && currentOrder ? (
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-center justify-between border-b pb-6">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900">Mesa {currentTable.number}</h2>
                <p className="text-zinc-500">Pedido #{currentOrder.id.slice(0, 8)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-500">Total a Pagar</p>
                <p className="text-4xl font-bold text-orange-600">R$ {currentOrder.total.toFixed(2)}</p>
              </div>
            </div>

            <div className="mb-8 space-y-4">
              <h3 className="font-bold text-zinc-900">Itens Consumidos</h3>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                {orderItems.map(item => (
                  <div key={item.id} className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-zinc-700">{item.quantity}x {item.productName}</span>
                    <span className="font-medium text-zinc-900">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-zinc-900">Forma de Pagamento</h3>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoPrint} 
                    onChange={(e) => setAutoPrint(e.target.checked)}
                    className="rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
                  />
                  Imprimir recibo ao fechar
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['credit', 'debit', 'pix', 'cash'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-xl border p-3 font-medium capitalize transition-colors ${
                      paymentMethod === method ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {method === 'credit' ? 'Crédito' : method === 'debit' ? 'Débito' : method === 'pix' ? 'Pix' : 'Dinheiro'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handlePrint(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 py-4 font-bold text-zinc-600 hover:bg-zinc-50"
              >
                <Printer size={20} /> Imprimir Pré-conta
              </button>
              <button
                onClick={handleCloseOrder}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 font-bold text-white hover:bg-orange-700"
              >
                <CheckCircle size={20} /> Confirmar Pagamento
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-zinc-400">
            <Calculator size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-medium">Selecione uma mesa para fechar a conta</p>
          </div>
        )}
      </div>
    </div>
  );
}
