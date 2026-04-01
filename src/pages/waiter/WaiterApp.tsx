import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Minus, ShoppingBag, ArrowLeft, CheckCircle, Clock, Utensils, Wine, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function WaiterApp() {
  const { userData: authUser } = useAuth();
  const navigate = useNavigate();
  const [waiterSession, setWaiterSession] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [cart, setCart] = useState<{product: any, quantity: number, notes: string}[]>([]);
  const [view, setView] = useState<'tables' | 'menu' | 'cart' | 'order'>('tables');

  useEffect(() => {
    const session = localStorage.getItem('waiter_session');
    if (session) {
      setWaiterSession(JSON.parse(session));
    } else if (!authUser) {
      navigate('/waiter/login');
    }
  }, [authUser, navigate]);

  const userData = waiterSession || authUser;

  const handleLogout = () => {
    localStorage.removeItem('waiter_session');
    navigate('/waiter/login');
  };

  useEffect(() => {
    // Listen to tables
    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a: any, b: any) => a.number - b.number));
    });

    // Listen to products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTables();
      unsubProducts();
    };
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

  // Create tables if none exist (just for demo/setup)
  const setupTables = async () => {
    for (let i = 1; i <= 10; i++) {
      await addDoc(collection(db, 'tables'), { number: i, status: 'free' });
    }
    toast.success('Mesas geradas!');
  };

  const handleTableClick = (table: any) => {
    setSelectedTable(table);
    setView('order');
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, notes: '' }];
    });
    toast.success(`${product.name} adicionado`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const sendOrder = async () => {
    if (cart.length === 0 || !currentTable || !userData) return;
    try {
      // Pre-fetch recipes for composite products outside the transaction
      const compositeItems = cart.filter(item => item.product.isComposite);
      const recipesMap = new Map();
      for (const item of compositeItems) {
        const recipesQuery = query(collection(db, 'recipes'), where('productId', '==', item.product.id));
        const recipesSnap = await getDocs(recipesQuery);
        if (!recipesSnap.empty) {
          recipesMap.set(item.product.id, recipesSnap.docs[0].data());
        }
      }

      await runTransaction(db, async (transaction) => {
        // --- READ PHASE ---
        const tableRef = doc(db, 'tables', currentTable.id);
        const tableSnap = await transaction.get(tableRef);
        if (!tableSnap.exists()) throw new Error("Mesa não encontrada");
        
        const tableData = tableSnap.data();
        let orderId = tableData.currentOrderId;

        let orderSnap = null;
        if (orderId) {
          const orderRef = doc(db, 'orders', orderId);
          orderSnap = await transaction.get(orderRef);
        }

        // Read all products and ingredients needed for stock deduction
        const productSnaps = new Map();
        for (const item of cart) {
          if (!item.product.isComposite) {
            const productRef = doc(db, 'products', item.product.id);
            if (!productSnaps.has(item.product.id)) {
              productSnaps.set(item.product.id, await transaction.get(productRef));
            }
          } else {
            const recipe = recipesMap.get(item.product.id);
            if (recipe) {
              for (const ingredient of recipe.ingredients) {
                const ingRef = doc(db, 'products', ingredient.ingredientId);
                if (!productSnaps.has(ingredient.ingredientId)) {
                  productSnaps.set(ingredient.ingredientId, await transaction.get(ingRef));
                }
              }
            }
          }
        }

        // --- WRITE PHASE ---
        let totalAddition = 0;
        let finalOrderId = orderId;

        if (!finalOrderId) {
          // Create new order
          const newOrderRef = doc(collection(db, 'orders'));
          finalOrderId = newOrderRef.id;
          transaction.set(newOrderRef, {
            tableId: currentTable.id,
            waiterId: userData.uid || userData.id,
            waiterName: userData.name,
            status: 'open',
            total: 0,
            createdAt: new Date().toISOString()
          });
          
          transaction.update(tableRef, {
            status: 'occupied',
            currentOrderId: finalOrderId
          });
        }

        for (const item of cart) {
          // Add Order Items
          const itemRef = doc(collection(db, 'orderItems'));
          transaction.set(itemRef, {
            orderId: finalOrderId,
            tableId: currentTable.id,
            tableNumber: currentTable.number,
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            status: 'pending',
            type: item.product.category === 'drink' ? 'drink' : 'food',
            notes: item.notes,
            createdAt: new Date().toISOString()
          });
          totalAddition += item.product.price * item.quantity;

          // Stock Deduction
          if (!item.product.isComposite) {
            const pSnap = productSnaps.get(item.product.id);
            if (pSnap && pSnap.exists()) {
              const currentStock = pSnap.data().stock || 0;
              transaction.update(pSnap.ref, { stock: currentStock - item.quantity });
              
              const movementRef = doc(collection(db, 'stockMovements'));
              transaction.set(movementRef, {
                productId: item.product.id,
                productName: item.product.name,
                type: 'out',
                quantity: item.quantity,
                reason: 'sale',
                date: new Date().toISOString(),
                orderId: finalOrderId
              });
            }
          } else {
            const recipe = recipesMap.get(item.product.id);
            if (recipe) {
              for (const ingredient of recipe.ingredients) {
                const ingSnap = productSnaps.get(ingredient.ingredientId);
                if (ingSnap && ingSnap.exists()) {
                  const currentIngStock = ingSnap.data().stock || 0;
                  const deduction = ingredient.quantity * item.quantity;
                  transaction.update(ingSnap.ref, { stock: currentIngStock - deduction });

                  const movementRef = doc(collection(db, 'stockMovements'));
                  transaction.set(movementRef, {
                    productId: ingredient.ingredientId,
                    productName: ingredient.name,
                    type: 'out',
                    quantity: deduction,
                    reason: 'sale',
                    date: new Date().toISOString(),
                    orderId: finalOrderId,
                    parentProductId: item.product.id
                  });
                }
              }
            }
          }
        }

        // Update Order Total
        if (orderId && orderSnap && orderSnap.exists()) {
          const currentTotal = orderSnap.data().total || 0;
          transaction.update(orderSnap.ref, { total: currentTotal + totalAddition });
        } else if (!orderId) {
          // We just created it, we can update the total since we have the ref
          const newOrderRef = doc(db, 'orders', finalOrderId);
          transaction.update(newOrderRef, { total: totalAddition });
        }
      });

      setCart([]);
      setView('order');
      toast.success('Pedido enviado para preparo!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao enviar pedido');
    }
  };

  const requestCheckout = async () => {
    if (!currentTable || !currentTable.currentOrderId) return;
    try {
      await updateDoc(doc(db, 'tables', currentTable.id), {
        status: 'billing'
      });
      toast.success('Fechamento solicitado ao caixa');
      setView('tables');
      setSelectedTable(null);
    } catch (error) {
      toast.error('Erro ao solicitar fechamento');
    }
  };

  if (view === 'tables') {
    return (
      <div className="p-4 pb-20 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Mesas</h1>
            <p className="text-sm text-zinc-500">Olá, {userData?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            {tables.length === 0 && (
              <button onClick={setupTables} className="text-sm text-blue-600">Gerar Mesas</button>
            )}
            <button onClick={handleLogout} className="text-zinc-400 hover:text-red-600">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-4 transition-all ${
                table.status === 'free' ? 'border-zinc-200 bg-white text-zinc-600 hover:border-orange-500' :
                table.status === 'occupied' ? 'border-orange-500 bg-orange-50 text-orange-700' :
                'border-blue-500 bg-blue-50 text-blue-700'
              }`}
            >
              <span className="text-3xl font-bold">{table.number}</span>
              <span className="mt-2 text-xs font-medium uppercase tracking-wider">
                {table.status === 'free' ? 'Livre' : table.status === 'occupied' ? 'Ocupada' : 'Fechando'}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'order') {
    return (
      <div className="flex h-full flex-col bg-zinc-50 pb-20 md:pb-0">
        <div className="flex items-center justify-between border-b bg-white p-4 shadow-sm">
          <button onClick={() => { setView('tables'); setSelectedTable(null); }} className="flex items-center gap-2 text-zinc-600">
            <ArrowLeft size={20} /> Voltar
          </button>
          <h2 className="text-lg font-bold">Mesa {currentTable?.number}</h2>
          <div className="w-20"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {orderItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-zinc-400">
              <ShoppingBag size={48} className="mb-4 opacity-20" />
              <p>Nenhum pedido nesta mesa</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orderItems.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.type === 'food' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                      {item.type === 'food' ? <Utensils size={18} /> : <Wine size={18} />}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">{item.quantity}x {item.productName}</p>
                      {item.notes && <p className="text-xs text-zinc-500">Obs: {item.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    <span className={`text-xs font-medium uppercase ${
                      item.status === 'pending' ? 'text-orange-500' :
                      item.status === 'preparing' ? 'text-blue-500' :
                      item.status === 'ready' ? 'text-green-500' : 'text-zinc-400'
                    }`}>
                      {item.status === 'pending' ? 'Pendente' :
                       item.status === 'preparing' ? 'Preparando' :
                       item.status === 'ready' ? 'Pronto' : 'Entregue'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {currentOrder && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500">Total Parcial</span>
              <span className="text-xl font-bold text-zinc-900">R$ {currentOrder.total.toFixed(2)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('menu')}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-medium text-white hover:bg-orange-700"
            >
              <Plus size={20} /> Adicionar
            </button>
            <button
              onClick={requestCheckout}
              disabled={!currentOrder || currentTable?.status === 'billing'}
              className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              <CheckCircle size={20} /> Fechar Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'menu') {
    const categories = ['food', 'drink'];
    return (
      <div className="flex h-full flex-col bg-zinc-50 pb-20 md:pb-0">
        <div className="flex items-center justify-between border-b bg-white p-4 shadow-sm">
          <button onClick={() => setView('order')} className="flex items-center gap-2 text-zinc-600">
            <ArrowLeft size={20} /> Voltar
          </button>
          <h2 className="text-lg font-bold">Cardápio</h2>
          <button onClick={() => setView('cart')} className="relative flex items-center p-2 text-zinc-900">
            <ShoppingBag size={24} />
            {cart.length > 0 && (
              <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                {cart.reduce((a,b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {categories.map(cat => (
            <div key={cat} className="mb-8">
              <h3 className="mb-4 text-lg font-bold capitalize text-zinc-900">{cat === 'food' ? 'Comidas' : 'Bebidas'}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {products.filter(p => p.category === cat).map(product => (
                  <div key={product.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                    <div>
                      <p className="font-medium text-zinc-900">{product.name}</p>
                      <p className="text-sm font-bold text-orange-600">R$ {product.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'cart') {
    const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    return (
      <div className="flex h-full flex-col bg-zinc-50 pb-20 md:pb-0">
        <div className="flex items-center justify-between border-b bg-white p-4 shadow-sm">
          <button onClick={() => setView('menu')} className="flex items-center gap-2 text-zinc-600">
            <ArrowLeft size={20} /> Voltar
          </button>
          <h2 className="text-lg font-bold">Novo Pedido</h2>
          <div className="w-20"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-500">Carrinho vazio</div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-zinc-900">{item.product.name}</p>
                    <p className="font-bold text-orange-600">R$ {(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-1">
                      <button onClick={() => updateCartQuantity(item.product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 text-zinc-600"><Minus size={16} /></button>
                      <span className="w-6 text-center font-medium">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.product.id, 1)} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 text-zinc-600"><Plus size={16} /></button>
                    </div>
                    <input
                      type="text"
                      placeholder="Observações..."
                      value={item.notes}
                      onChange={(e) => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, notes: e.target.value } : i))}
                      className="w-1/2 rounded-lg border border-zinc-200 p-2 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">Total</span>
            <span className="text-xl font-bold text-zinc-900">R$ {total.toFixed(2)}</span>
          </div>
          <button
            onClick={sendOrder}
            disabled={cart.length === 0}
            className="w-full rounded-xl bg-orange-600 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Enviar para Preparo
          </button>
        </div>
      </div>
    );
  }

  return null;
}
