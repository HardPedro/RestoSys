import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Finance() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'payable',
    amount: 0,
    description: '',
    status: 'pending',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'supplies'
  });

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'transactions'), {
        ...formData,
        amount: parseFloat(formData.amount.toString()),
        createdAt: new Date().toISOString()
      });
      toast.success('Transação registrada!');
      setIsModalOpen(false);
      setFormData({ type: 'payable', amount: 0, description: '', status: 'pending', dueDate: new Date().toISOString().split('T')[0], category: 'supplies' });
    } catch (error) {
      toast.error('Erro ao salvar transação');
    }
  };

  const handlePay = async (id: string) => {
    try {
      await updateDoc(doc(db, 'transactions', id), {
        status: 'paid',
        paidDate: new Date().toISOString()
      });
      toast.success('Status atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const balance = transactions.reduce((acc, t) => {
    if (t.status === 'paid') {
      return t.type === 'receivable' ? acc + t.amount : acc - t.amount;
    }
    return acc;
  }, 0);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-zinc-900">Financeiro</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
        >
          <Plus size={20} />
          Nova Transação
        </button>
      </div>

      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-500">Saldo Atual (Pago)</h2>
        <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          R$ {balance.toFixed(2)}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-700">
            <tr>
              <th className="px-6 py-4 font-semibold">Descrição</th>
              <th className="px-6 py-4 font-semibold">Tipo</th>
              <th className="px-6 py-4 font-semibold">Valor</th>
              <th className="px-6 py-4 font-semibold">Vencimento</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium text-zinc-900">{t.description}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${t.type === 'receivable' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.type === 'receivable' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className="px-6 py-4 font-medium">R$ {t.amount.toFixed(2)}</td>
                <td className="px-6 py-4">{new Date(t.dueDate).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4">
                  {t.status === 'paid' ? (
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle size={16} /> Pago</span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-600"><Clock size={16} /> Pendente</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {t.status === 'pending' && (
                    <button onClick={() => handlePay(t.id)} className="text-blue-600 hover:text-blue-800 font-medium">
                      Marcar Pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">Nova Transação</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Descrição</label>
                <input required type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-lg border p-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Tipo</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full rounded-lg border p-2">
                    <option value="payable">Despesa (Pagar)</option>
                    <option value="receivable">Receita (Receber)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Valor (R$)</label>
                  <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="w-full rounded-lg border p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Vencimento</label>
                  <input required type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full rounded-lg border p-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full rounded-lg border p-2">
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 font-medium text-zinc-600 hover:bg-zinc-100">Cancelar</button>
                <button type="submit" className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
