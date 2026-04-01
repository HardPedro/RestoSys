import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'food',
    unit: 'un',
    cost: 0,
    price: 0,
    stock: 0,
    minStock: 0,
    isComposite: false
  });

  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
  const [movements, setMovements] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMovements = onSnapshot(query(collection(db, 'stockMovements'), orderBy('date', 'desc')), (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsub();
      unsubMovements();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check for duplicate name
      const duplicate = products.find(p => p.name.toLowerCase() === formData.name.toLowerCase() && p.id !== editingId);
      if (duplicate) {
        toast.error('Já existe um produto com este nome!');
        return;
      }

      let productId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), formData);
        toast.success('Produto atualizado!');
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        productId = docRef.id;
        toast.success('Produto criado!');
      }

      // Handle Recipe if composite
      if (formData.isComposite && productId) {
        const recipesQuery = query(collection(db, 'recipes'), where('productId', '==', productId));
        const recipesSnap = await getDocs(recipesQuery);
        
        if (recipesSnap.empty) {
          await addDoc(collection(db, 'recipes'), {
            productId,
            ingredients: recipeIngredients,
            updatedAt: new Date().toISOString()
          });
        } else {
          await updateDoc(doc(db, 'recipes', recipesSnap.docs[0].id), {
            ingredients: recipeIngredients,
            updatedAt: new Date().toISOString()
          });
        }
      }

      setIsModalOpen(false);
      setEditingId(null);
      setRecipeIngredients([]);
      setFormData({ name: '', description: '', category: 'food', unit: 'un', cost: 0, price: 0, stock: 0, minStock: 0, isComposite: false });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar produto');
    }
  };

  const [recipeIngredients, setRecipeIngredients] = useState<any[]>([]);

  const handleEdit = async (product: any) => {
    setFormData(product);
    setEditingId(product.id);
    if (product.isComposite) {
      const q = query(collection(db, 'recipes'), where('productId', '==', product.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setRecipeIngredients(snap.docs[0].data().ingredients || []);
      } else {
        setRecipeIngredients([]);
      }
    } else {
      setRecipeIngredients([]);
    }
    setIsModalOpen(true);
  };

  const addIngredientToRecipe = (ingredientId: string, quantity: number) => {
    const ingredient = products.find(p => p.id === ingredientId);
    if (!ingredient) return;
    setRecipeIngredients(prev => {
      const existing = prev.find(i => i.ingredientId === ingredientId);
      if (existing) {
        return prev.map(i => i.ingredientId === ingredientId ? { ...i, quantity } : i);
      }
      return [...prev, { ingredientId, name: ingredient.name, quantity, unit: ingredient.unit }];
    });
  };

  const removeIngredientFromRecipe = (ingredientId: string) => {
    setRecipeIngredients(prev => prev.filter(i => i.ingredientId !== ingredientId));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir?')) {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Produto excluído');
    }
  };

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    productId: '',
    quantity: 0,
    type: 'in' as 'in' | 'out',
    reason: 'purchase'
  });

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const product = products.find(p => p.id === adjustmentData.productId);
      if (!product) return;

      const newStock = adjustmentData.type === 'in' 
        ? product.stock + adjustmentData.quantity 
        : product.stock - adjustmentData.quantity;

      await updateDoc(doc(db, 'products', product.id), { stock: newStock });
      
      await addDoc(collection(db, 'stockMovements'), {
        productId: product.id,
        productName: product.name,
        type: adjustmentData.type,
        quantity: adjustmentData.quantity,
        reason: adjustmentData.reason,
        date: new Date().toISOString()
      });

      toast.success('Estoque ajustado!');
      setIsAdjustmentModalOpen(false);
      setAdjustmentData({ productId: '', quantity: 0, type: 'in', reason: 'purchase' });
    } catch (error) {
      toast.error('Erro ao ajustar estoque');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">Estoque</h1>
        <div className="flex flex-wrap gap-2 md:gap-4">
          <div className="flex rounded-lg bg-zinc-100 p-1">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`rounded-md px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${activeTab === 'inventory' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Inventário
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`rounded-md px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${activeTab === 'movements' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Movimentação
            </button>
          </div>
          <button
            onClick={() => setIsAdjustmentModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-600 px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-orange-600 hover:bg-orange-50"
          >
            Ajustar
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus size={18} className="md:w-5 md:h-5" />
            Novo
          </button>
        </div>
      </div>

      {/* ... existing tables ... */}

      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">Ajustar Estoque</h2>
            <form onSubmit={handleAdjustment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Produto</label>
                <select 
                  required 
                  value={adjustmentData.productId} 
                  onChange={e => setAdjustmentData({...adjustmentData, productId: e.target.value})}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="">Selecione o produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Atual: {p.stock} {p.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Tipo</label>
                  <select 
                    value={adjustmentData.type} 
                    onChange={e => setAdjustmentData({...adjustmentData, type: e.target.value as 'in' | 'out'})}
                    className="w-full rounded-lg border p-2"
                  >
                    <option value="in">Entrada (+)</option>
                    <option value="out">Saída (-)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Quantidade</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    value={adjustmentData.quantity} 
                    onChange={e => setAdjustmentData({...adjustmentData, quantity: parseFloat(e.target.value)})}
                    className="w-full rounded-lg border p-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Motivo</label>
                <select 
                  value={adjustmentData.reason} 
                  onChange={e => setAdjustmentData({...adjustmentData, reason: e.target.value})}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="purchase">Compra / Reposição</option>
                  <option value="adjustment">Ajuste Manual</option>
                  <option value="waste">Desperdício / Perda</option>
                  <option value="return">Devolução</option>
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="rounded-lg px-4 py-2 font-medium text-zinc-600 hover:bg-zinc-100">Cancelar</button>
                <button type="submit" className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'inventory' ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nome</th>
                  <th className="px-6 py-4 font-semibold">Categoria</th>
                  <th className="px-6 py-4 font-semibold">Preço</th>
                  <th className="px-6 py-4 font-semibold">Estoque</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{product.name}</td>
                    <td className="px-6 py-4 capitalize">{product.category}</td>
                    <td className="px-6 py-4">R$ {product.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={product.stock <= product.minStock ? 'text-red-600 font-bold' : ''}>
                          {product.stock} {product.unit}
                        </span>
                        {product.stock <= product.minStock && (
                          <AlertTriangle size={16} className="text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(product)} className="mr-3 text-blue-600 hover:text-blue-800">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-4 md:hidden">
            {products.map((product) => (
              <div key={product.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-zinc-900">{product.name}</h3>
                    <p className="text-xs capitalize text-zinc-500">{product.category}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(product)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-600">R$ {product.price.toFixed(2)}</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-bold ${product.stock <= product.minStock ? 'text-red-600' : 'text-zinc-900'}`}>
                      {product.stock} {product.unit}
                    </span>
                    {product.stock <= product.minStock && (
                      <AlertTriangle size={14} className="text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Desktop Table Movements */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Data</th>
                  <th className="px-6 py-4 font-semibold">Produto</th>
                  <th className="px-6 py-4 font-semibold">Tipo</th>
                  <th className="px-6 py-4 font-semibold">Qtd</th>
                  <th className="px-6 py-4 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">{new Date(m.date).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4 font-medium text-zinc-900">{m.productName}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${m.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.type === 'in' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">{m.quantity}</td>
                    <td className="px-6 py-4 capitalize">{m.reason === 'sale' ? 'Venda' : m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards Movements */}
          <div className="grid gap-4 md:hidden">
            {movements.map((m) => (
              <div key={m.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{new Date(m.date).toLocaleString('pt-BR')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${m.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {m.type === 'in' ? 'Entrada' : 'Saída'}
                  </span>
                </div>
                <h3 className="font-bold text-zinc-900">{m.productName}</h3>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="capitalize text-zinc-500">{m.reason === 'sale' ? 'Venda' : m.reason}</span>
                  <span className="font-bold text-zinc-900">{m.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-lg border p-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Categoria</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full rounded-lg border p-2">
                    <option value="food">Comida</option>
                    <option value="drink">Bebida</option>
                    <option value="ingredient">Ingrediente</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Unidade</label>
                  <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full rounded-lg border p-2">
                    <option value="un">Unidade</option>
                    <option value="kg">Kg</option>
                    <option value="l">Litro</option>
                    <option value="g">Grama</option>
                    <option value="ml">Mililitro</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Custo (R$)</label>
                  <input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} className="w-full rounded-lg border p-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Preço (R$)</label>
                  <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full rounded-lg border p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Estoque</label>
                  <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: parseFloat(e.target.value)})} className="w-full rounded-lg border p-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Estoque Mínimo</label>
                  <input type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value)})} className="w-full rounded-lg border p-2" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isComposite" checked={formData.isComposite} onChange={e => setFormData({...formData, isComposite: e.target.checked})} />
                <label htmlFor="isComposite" className="text-sm font-medium">Produto Composto (Ficha Técnica)</label>
              </div>

              {formData.isComposite && (
                <div className="rounded-xl border border-zinc-200 p-4">
                  <h3 className="mb-3 text-sm font-bold">Composição (Ficha Técnica)</h3>
                  <div className="mb-3 space-y-2">
                    {recipeIngredients.map(ing => (
                      <div key={ing.ingredientId} className="flex items-center justify-between text-sm">
                        <span>{ing.name} ({ing.quantity}{ing.unit})</span>
                        <button type="button" onClick={() => removeIngredientFromRecipe(ing.ingredientId)} className="text-red-500">Remover</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 rounded-lg border p-2 text-sm"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) addIngredientToRecipe(val, 1);
                      }}
                      value=""
                    >
                      <option value="">Adicionar Ingrediente...</option>
                      {products.filter(p => p.category === 'ingredient' || p.category === 'food' || p.category === 'drink').map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
