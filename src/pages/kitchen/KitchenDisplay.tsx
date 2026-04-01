import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CheckCircle, Clock, Play, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { printReceipt } from '../../lib/print';

export default function KitchenDisplay() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'orderItems'),
      where('type', '==', 'food'),
      where('status', 'in', ['pending', 'preparing']),
      orderBy('createdAt', 'asc')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => unsub();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orderItems', id), { status: newStatus });
      toast.success(`Status atualizado para ${newStatus}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handlePrint = (item: any) => {
    const content = `
      <div class="text-center border-b">
        <h2>COZINHA</h2>
        <p>${new Date(item.createdAt).toLocaleString('pt-BR')}</p>
      </div>
      <div class="border-b">
        <h1 class="text-xl">MESA ${item.tableNumber || '?'}</h1>
      </div>
      <div class="border-b">
        <p class="text-lg bold">${item.quantity}x ${item.productName}</p>
        ${item.notes ? `<p>OBS: ${item.notes}</p>` : ''}
      </div>
      <div class="text-center">
        <p>*** FIM ***</p>
      </div>
    `;
    printReceipt(content);
  };

  const pendingItems = items.filter(i => i.status === 'pending');
  const preparingItems = items.filter(i => i.status === 'preparing');

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 p-4 md:p-8">
      <h1 className="mb-6 text-2xl md:text-3xl font-bold text-zinc-900">Cozinha - Pedidos</h1>
      
      <div className="grid flex-1 gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Pendentes */}
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-orange-600">
              <Clock size={24} /> Pendentes
            </h2>
            <span className="rounded-full bg-orange-100 px-3 py-1 font-bold text-orange-600">{pendingItems.length}</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {pendingItems.map(item => (
              <div key={item.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className="text-sm font-bold text-zinc-500">Mesa {item.tableNumber || '?'}</span>
                    <p className="text-lg font-bold text-zinc-900">{item.quantity}x {item.productName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleTimeString()}</span>
                    <button onClick={() => handlePrint(item)} className="text-zinc-400 hover:text-zinc-600" title="Imprimir Comanda">
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
                {item.notes && <p className="mb-4 text-sm font-medium text-red-600">Obs: {item.notes}</p>}
                <button
                  onClick={() => updateStatus(item.id, 'preparing')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700"
                >
                  <Play size={18} /> Iniciar Preparo
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preparando */}
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-blue-600">
              <Play size={24} /> Em Preparo
            </h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-600">{preparingItems.length}</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {preparingItems.map(item => (
              <div key={item.id} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className="text-sm font-bold text-blue-500">Mesa {item.tableNumber || '?'}</span>
                    <p className="text-lg font-bold text-zinc-900">{item.quantity}x {item.productName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleTimeString()}</span>
                    <button onClick={() => handlePrint(item)} className="text-blue-400 hover:text-blue-600" title="Imprimir Comanda">
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
                {item.notes && <p className="mb-4 text-sm font-medium text-red-600">Obs: {item.notes}</p>}
                <button
                  onClick={() => updateStatus(item.id, 'ready')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-700"
                >
                  <CheckCircle size={18} /> Marcar como Pronto
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
