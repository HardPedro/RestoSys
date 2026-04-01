import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Utensils, Wine, Info } from 'lucide-react';

export default function QRMenu() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  const categories = ['food', 'drink'];

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      {/* Header */}
      <div className="bg-orange-600 px-6 py-12 text-white shadow-lg">
        <h1 className="text-3xl font-bold">Nosso Cardápio</h1>
        <p className="mt-2 text-orange-100 italic">Sinta-se em casa e aproveite!</p>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        {categories.map(cat => (
          <div key={cat} className="mt-8">
            <div className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2">
              {cat === 'food' ? <Utensils className="text-orange-600" /> : <Wine className="text-orange-600" />}
              <h2 className="text-xl font-bold capitalize text-zinc-900">
                {cat === 'food' ? 'Comidas' : 'Bebidas'}
              </h2>
            </div>
            
            <div className="grid gap-4">
              {products
                .filter(p => p.category === cat)
                .map(product => (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm transition-transform active:scale-[0.98]">
                    <div className="flex-1">
                      <h3 className="font-bold text-zinc-900">{product.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{product.description}</p>
                      <p className="mt-2 text-lg font-bold text-orange-600">
                        R$ {product.price.toFixed(2)}
                      </p>
                    </div>
                    {/* Placeholder for image if needed */}
                    <div className="ml-4 h-20 w-20 flex-shrink-0 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-300">
                      <Info size={24} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 px-6 text-center text-zinc-400">
        <p className="text-xs uppercase tracking-widest">© 2026 Restaurante Express</p>
      </div>
    </div>
  );
}
