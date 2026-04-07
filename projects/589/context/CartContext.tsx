import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useMemo,
  Dispatch,
  useEffect,
} from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variantId?: string;
  [key: string]: unknown;
};

export type CartState = {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
};

type AddItemInput = Omit<CartItem, "quantity"> & { quantity?: number };

type CartAction =
  | { type: "ADD_ITEM"; payload: AddItemInput }
  | { type: "REMOVE_ITEM"; payload: { id: string; variantId?: string } }
  | {
      type: "UPDATE_ITEM_QUANTITY";
      payload: { id: string; variantId?: string; quantity: number };
    }
  | { type: "CLEAR_CART" }
  | { type: "SET_CART"; payload: CartState };

type CartContextValue = {
  state: CartState;
  addItem: (item: AddItemInput) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateItemQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
};

type CartProviderProps = {
  children: ReactNode;
};

const STORAGE_KEY = "app_cart_v1";

const initialState: CartState = {
  items: [],
  totalQuantity: 0,
  subtotal: 0,
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const calculateTotals = (items: CartItem[]): Pick<CartState, "totalQuantity" | "subtotal"> => {
  return items.reduce(
    (acc, item) => {
      const quantity = item.quantity > 0 ? item.quantity : 0;
      acc.totalQuantity += quantity;
      acc.subtotal += item.price * quantity;
      return acc;
    },
    { totalQuantity: 0, subtotal: 0 }
  );
};

const findItemIndex = (items: CartItem[], id: string, variantId?: string): number => {
  return items.findIndex(
    (item) => item.id === id && (variantId === undefined || item.variantId === variantId)
  );
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "ADD_ITEM": {
      const quantityToAdd = action.payload.quantity ?? 1;
      if (quantityToAdd <= 0) return state;

      const existingIndex = findItemIndex(
        state.items,
        action.payload.id,
        action.payload.variantId
      );

      let updatedItems: CartItem[];
      if (existingIndex >= 0) {
        updatedItems = state.items.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: item.quantity + quantityToAdd,
              }
            : item
        );
      } else {
        updatedItems = [
          ...state.items,
          {
            ...action.payload,
            quantity: quantityToAdd,
          },
        ];
      }

      const totals = calculateTotals(updatedItems);
      return {
        ...state,
        items: updatedItems,
        ...totals,
      };
    }

    case "REMOVE_ITEM": {
      const updatedItems = state.items.filter(
        (item) =>
          !(item.id === action.payload.id &&
            (action.payload.variantId === undefined ||
              item.variantId === action.payload.variantId))
      );

      const totals = calculateTotals(updatedItems);
      return {
        ...state,
        items: updatedItems,
        ...totals,
      };
    }

    case "UPDATE_ITEM_QUANTITY": {
      const { id, variantId, quantity } = action.payload;
      if (quantity < 0) return state;

      const existingIndex = findItemIndex(state.items, id, variantId);
      if (existingIndex === -1) return state;

      let updatedItems: CartItem[];
      if (quantity === 0) {
        updatedItems = state.items.filter(
          (item) =>
            !(item.id === id && (variantId === undefined || item.variantId === variantId))
        );
      } else {
        updatedItems = state.items.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity,
              }
            : item
        );
      }

      const totals = calculateTotals(updatedItems);
      return {
        ...state,
        items: updatedItems,
        ...totals,
      };
    }

    case "CLEAR_CART": {
      return {
        ...initialState,
      };
    }

    case "SET_CART": {
      const totals = calculateTotals(action.payload.items);
      return {
        ...action.payload,
        ...totals,
      };
    }

    default:
      return state;
  }
};

const loadInitialCartState = (): CartState => {
  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;

    const parsed = JSON.parse(stored) as Partial<CartState> | null;
    if (!parsed || !Array.isArray(parsed.items)) return initialState;

    const items = parsed.items
      .filter((item: unknown): item is CartItem => {
        if (!item || typeof item !== "object") return false;
        const i = item as CartItem;
        return (
          typeof i.id === "string" &&
          typeof i.name === "string" &&
          typeof i.price === "number" &&
          typeof i.quantity === "number"
        );
      })
      .map((item) => ({
        ...item,
        quantity: item.quantity > 0 ? item.quantity : 0,
      }));

    const totals = calculateTotals(items);

    return {
      items,
      ...totals,
    };
  } catch {
    return initialState;
  }
};

const persistCartState = (state: CartState): void => {
  if (typeof window === "undefined") return;
  try {
    const toStore: CartState = {
      items: state.items,
      totalQuantity: state.totalQuantity,
      subtotal: state.subtotal,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore persistence errors
  }
};

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch]: [CartState, Dispatch<CartAction>] = useReducer(
    cartReducer,
    undefined,
    loadInitialCartState
  );

  useEffect(() => {
    persistCartState(state);
  }, [state]);

  const addItem = (item: AddItemInput): void => {
    dispatch({ type: "ADD_ITEM", payload: item });
  };

  const removeItem = (id: string, variantId?: string): void => {
    dispatch({ type: "REMOVE_ITEM", payload: { id, variantId } });
  };

  const updateItemQuantity = (id: string, quantity: number, variantId?: string): void => {
    dispatch({
      type: "UPDATE_ITEM_QUANTITY",
      payload: { id, variantId, quantity },
    });
  };

  const clearCart = (): void => {
    dispatch({ type: "CLEAR_CART" });
  };

  const value: CartContextValue = useMemo(
    () => ({
      state,
      addItem,
      removeItem,
      updateItemQuantity,
      clearCart,
    }),
    [state]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};