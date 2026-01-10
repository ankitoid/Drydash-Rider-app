// app/context/CartContext.tsx
import React, { createContext, useContext, useState } from "react";

export type CartItem = {
  id: string;
  title: string;
  price: number;
  image?: any; // require(...) or uri
  qty: number;
  meta?: any;
};

type CartCtx = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  getQty: (id: string) => number;
  total: () => number;
};

const CartContext = createContext<CartCtx | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, "qty">, qty = 1) => {
    setItems(prev => {
      const found = prev.find(p => p.id === item.id);
      if (found) {
        return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + qty } : p);
      }
      return [...prev, { ...item, qty }];
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
  };

  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return removeItem(id);
    setItems(prev => prev.map(p => p.id === id ? { ...p, qty } : p));
  };

  const getQty = (id: string) => items.find(i => i.id === id)?.qty ?? 0;

  const clear = () => setItems([]);

  const total = () => items.reduce((s, it) => s + it.price * it.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, setQty, clear, getQty, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};
