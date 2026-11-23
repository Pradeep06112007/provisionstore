import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "freshmart-cart";

function resolveProductKey(item) {
  if (!item) return "";
  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }
  const raw =
    item._id ??
    item.id ??
    item.productId ??
    item.sku ??
    item.name ??
    item.title ??
    "";
  return String(raw).trim();
}

function normalizeCartList(list) {
  if (!Array.isArray(list)) return [];
  const merged = new Map();

  for (const rawItem of list) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const key = resolveProductKey(rawItem);
    if (!key) continue;

    const qty = Math.max(1, Number(rawItem.qty ?? rawItem.quantity ?? 1) || 1);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        qty: existing.qty + qty,
        quantity: existing.qty + qty,
      });
    } else {
      merged.set(key, {
        ...rawItem,
        _id: rawItem._id ?? key,
        id: rawItem.id ?? key,
        qty,
        quantity: qty,
      });
    }
  }

  return Array.from(merged.values());
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? normalizeCartList(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  const addToCart = useCallback((product) => {
    const key = resolveProductKey(product);
    if (!key) return;

    setCart((prev) => {
      const index = prev.findIndex((item) => resolveProductKey(item) === key);
      if (index >= 0) {
        const next = [...prev];
        const nextQty = (Number(next[index].qty ?? next[index].quantity) || 1) + 1;
        next[index] = {
          ...next[index],
          qty: nextQty,
          quantity: nextQty,
        };
        return next;
      }

      return [
        ...prev,
        {
          ...product,
          _id: product._id ?? key,
          id: product.id ?? key,
          qty: 1,
          quantity: 1,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productOrId, newQty) => {
    const key = resolveProductKey(productOrId);
    if (!key) return;
    const numericQty = Number(newQty) || 0;

    setCart((prev) => {
      if (numericQty <= 0) {
        return prev.filter((item) => resolveProductKey(item) !== key);
      }
      return prev.map((item) =>
        resolveProductKey(item) === key
          ? { ...item, qty: numericQty, quantity: numericQty }
          : item
      );
    });
  }, []);

  const decreaseQty = useCallback((productOrId) => {
    const key = resolveProductKey(productOrId);
    if (!key) return;

    setCart((prev) => {
      const index = prev.findIndex((item) => resolveProductKey(item) === key);
      if (index < 0) return prev;
      const currentQty = Number(prev[index].qty ?? prev[index].quantity) || 1;
      if (currentQty <= 1) {
        return prev.filter((_, i) => i !== index);
      }
      const next = [...prev];
      next[index] = {
        ...next[index],
        qty: currentQty - 1,
        quantity: currentQty - 1,
      };
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productOrId) => {
    const key = resolveProductKey(productOrId);
    if (!key) return;
    setCart((prev) => prev.filter((item) => resolveProductKey(item) !== key));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const cartCount = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (Number(item.qty ?? item.quantity) || 1),
        0
      ),
    [cart]
  );

  const totalAmount = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const price = Number(item.price || 0);
        const qty = Number(item.qty ?? item.quantity) || 1;
        return sum + price * qty;
      }, 0),
    [cart]
  );

  const value = useMemo(
    () => ({
      cart,
      items: cart,
      cartItems: cart,
      cartCount,
      totalItems: cartCount,
      totalAmount,
      addToCart,
      incrementQty: addToCart,
      decreaseQty,
      decrementQty: decreaseQty,
      updateQuantity,
      updateQty: updateQuantity,
      removeFromCart,
      removeItem: removeFromCart,
      clearCart,
    }),
    [
      cart,
      cartCount,
      totalAmount,
      addToCart,
      decreaseQty,
      updateQuantity,
      removeFromCart,
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}