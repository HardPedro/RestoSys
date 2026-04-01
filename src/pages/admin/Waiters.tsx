import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Edit, Trash2, UserCheck, Key } from 'lucide-react';
import { toast } from 'sonner';

export default function Waiters() {
  const [waiters, setWaiters] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    pin: '',
    role: 'waiter'
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'waiter'));
    const unsub = onSnapshot(q, (snapshot) => {
      setWaiters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), formData);
        toast.success('Garçom atualizado!');
      } else {
        // For simplicity, we create a user record directly in Firestore.
        // In a real app, we'd use Firebase Auth to create the user.
        // But the user asked for "waiter entities" and "passwords" (PINs).
        await addDoc(collection(db, 'users'), {
          ...formData,
          uid: `waiter_${Date.now()}`, // Temporary UID for custom login
          createdAt: new Date().toISOString()
        });
        toast.success('Garçom criado!');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', email: '', pin: '', role: 'waiter' });
    } catch (error) {
      toast.error('Erro ao salvar garçom');
    }
  };

  const handleEdit = (waiter: any) => {
    setFormData(waiter);
    setEditingId(waiter.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este garçom?')) {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Garçom excluído');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">Garçons</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
        >
          <Plus size={20} />
          Novo Garçom
        </button>
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {waiters.map((waiter) => (
          <div key={waiter.id} className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <UserCheck size={20} className="md:w-6 md:h-6" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(waiter)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(waiter.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-zinc-900">{waiter.name}</h3>
            <p className="text-sm text-zinc-500 truncate">{waiter.email}</p>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-50 p-2 text-sm font-medium text-zinc-700">
              <Key size={16} className="text-zinc-400" />
              PIN: {waiter.pin}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">{editingId ? 'Editar Garçom' : 'Novo Garçom'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome Completo</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-lg border p-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-mail (Opcional)</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full rounded-lg border p-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">PIN de Acesso (4-6 dígitos)</label>
                <input required type="text" maxLength={6} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full rounded-lg border p-2 text-center text-2xl font-bold tracking-widest" />
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
