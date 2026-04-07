import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface Cart {
  id: string;
  items: CartItem[];
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  [key: string]: unknown;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface AddToCartInput {
  productId: string;
  quantity?: number;
  options?: Record<string, unknown>;
}

export interface UpdateCartItemInput {
  cartItemId: string;
  quantity: number;
}

export interface RemoveCartItemInput {
  cartItemId: string;
}

const CART_QUERY_KEY = ["cart"];

async function fetchCart(): Promise<Cart> {
  const response = await fetch("/api/cart", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch cart");
  }

  return response.json();
}

async function addItemToCart(input: AddToCartInput): Promise<Cart> {
  const response = await fetch("/api/cart/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      productId: input.productId,
      quantity: input.quantity ?? 1,
      options: input.options ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to add item to cart");
  }

  return response.json();
}

async function updateCartItemQuantity(
  input: UpdateCartItemInput
): Promise<Cart> {
  const response = await fetch(`/api/cart/items/undefined`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      quantity: input.quantity,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to update cart item");
  }

  return response.json();
}

async function removeCartItem(input: RemoveCartItemInput): Promise<Cart> {
  const response = await fetch(`/api/cart/items/undefined`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to remove cart item");
  }

  return response.json();
}

export function useCart(): UseQueryResult<Cart, Error> {
  return useQuery<Cart, Error>({
    queryKey: CART_QUERY_KEY,
    queryFn: fetchCart,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
  });
}

export function useAddToCart(): UseMutationResult<Cart, Error, AddToCartInput> {
  const queryClient = useQueryClient();

  return useMutation<Cart, Error, AddToCartInput>({
    mutationFn: addItemToCart,
    onSuccess: (data) => {
      queryClient.setQueryData<Cart>(CART_QUERY_KEY, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useUpdateCartItem(): UseMutationResult<
  Cart,
  Error,
  UpdateCartItemInput
> {
  const queryClient = useQueryClient();

  return useMutation<Cart, Error, UpdateCartItemInput>({
    mutationFn: updateCartItemQuantity,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });

      const previousCart = queryClient.getQueryData<Cart>(CART_QUERY_KEY);

      if (previousCart) {
        const updatedItems = previousCart.items.map((item) =>
          item.id === variables.cartItemId
            ? { ...item, quantity: variables.quantity }
            : item
        );
        const optimisticCart: Cart = {
          ...previousCart,
          items: updatedItems,
        };
        queryClient.setQueryData<Cart>(CART_QUERY_KEY, optimisticCart);
      }

      return { previousCart };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData<Cart>(CART_QUERY_KEY, context.previousCart);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Cart>(CART_QUERY_KEY, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useRemoveCartItem(): UseMutationResult<
  Cart,
  Error,
  RemoveCartItemInput
> {
  const queryClient = useQueryClient();

  return useMutation<Cart, Error, RemoveCartItemInput>({
    mutationFn: removeCartItem,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });

      const previousCart = queryClient.getQueryData<Cart>(CART_QUERY_KEY);

      if (previousCart) {
        const updatedItems = previousCart.items.filter(
          (item) => item.id !== variables.cartItemId
        );
        const optimisticCart: Cart = {
          ...previousCart,
          items: updatedItems,
        };
        queryClient.setQueryData<Cart>(CART_QUERY_KEY, optimisticCart);
      }

      return { previousCart };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData<Cart>(CART_QUERY_KEY, context.previousCart);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Cart>(CART_QUERY_KEY, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useCartTotals(): CartTotals {
  const { data: cart } = useCart();

  return useMemo<CartTotals>(() => {
    if (!cart) {
      return {
        itemCount: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
      };
    }

    const itemCount = cart.items.reduce(
      (count, item) => count + item.quantity,
      0
    );

    const subtotal =
      typeof cart.subtotal === "number"
        ? cart.subtotal
        : cart.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );

    const tax =
      typeof cart.tax === "number"
        ? cart.tax
        : typeof cart.subtotal === "number"
        ? 0
        : 0;

    const total =
      typeof cart.total === "number"
        ? cart.total
        : subtotal + tax;

    return {
      itemCount,
      subtotal,
      tax,
      total,
    };
  }, [cart]);
}

export function useCartItemCount(): number {
  const totals = useCartTotals();
  return totals.itemCount;
}