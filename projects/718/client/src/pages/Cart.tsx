import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type CartProps = {
  items: CartItem[];
  currency?: string;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
};

const formatCurrency = (value: number, currency: string = "USD"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$undefined`;
  }
};

const Cart: React.FC<CartProps> = ({
  items,
  currency = "USD",
  onUpdateQuantity,
  onRemoveItem,
}) => {
  const navigate = useNavigate();

  const handleQuantityChange = useCallback(
    (id: string, quantity: number) => {
      if (Number.isNaN(quantity)) return;
      const safeQuantity = Math.max(1, Math.min(99, Math.floor(quantity)));
      onUpdateQuantity(id, safeQuantity);
    },
    [onUpdateQuantity]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onRemoveItem(id);
    },
    [onRemoveItem]
  );

  const handleCheckout = useCallback(() => {
    if (!items.length) return;
    navigate("/checkout");
  }, [items.length, navigate]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  return (
    <div className="cart-page min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Shopping Cart
          </h1>
          <div className="text-sm text-gray-600">
            {totalQuantity} item{totalQuantity !== 1 ? "s" : ""}
          </div>
        </header>

        {items.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="mb-4 text-lg font-medium text-gray-800">
              Your cart is empty
            </p>
            <p className="mb-6 text-sm text-gray-500">
              Add some products to your cart to see them here.
            </p>
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Browse products
            </button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
            <section className="lg:col-span-2">
              <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <ul className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <li key={item.id} className="flex px-4 py-4 sm:px-6">
                      <div className="flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-20 w-20 rounded-md object-cover sm:h-24 sm:w-24"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400 sm:h-24 sm:w-24">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex flex-1 flex-col sm:ml-6">
                        <div className="flex justify-between">
                          <div>
                            <h2 className="text-sm font-medium text-gray-900 sm:text-base">
                              {item.name}
                            </h2>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {formatCurrency(item.price, currency)}
                            </p>
                          </div>
                          <div className="ml-4 text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(item.price * item.quantity, currency)}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleRemove(item.id)}
                              className="mt-2 text-xs font-medium text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center">
                            <label
                              htmlFor={`quantity-undefined`}
                              className="mr-2 text-xs font-medium text-gray-700"
                            >
                              Qty
                            </label>
                            <div className="flex items-center rounded-md border border-gray-300 bg-white">
                              <button
                                type="button"
                                aria-label={`Decrease quantity of undefined`}
                                onClick={() =>
                                  handleQuantityChange(
                                    item.id,
                                    item.quantity - 1
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={item.quantity <= 1}
                              >
                                -
                              </button>
                              <input
                                id={`quantity-undefined`}
                                type="number"
                                min={1}
                                max={99}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    item.id,
                                    Number(e.target.value)
                                  )
                                }
                                className="h-8 w-12 border-x border-gray-200 text-center text-sm text-gray-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                aria-label={`Increase quantity of undefined`}
                                onClick={() =>
                                  handleQuantityChange(
                                    item.id,
                                    item.quantity + 1
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={item.quantity >= 99}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <aside className="lg:col-span-1">
              <div className="sticky top-6 rounded-lg bg-white p-6 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900">
                  Order Summary
                </h2>

                <dl className="mt-4 space-y-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <dt>Subtotal</dt>
                    <dd className="font-medium">
                      {formatCurrency(subtotal, currency)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <dt>Shipping</dt>
                    <dd>Calculated at checkout</dd>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <dt>Taxes</dt>
                    <dd>Calculated at checkout</dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                    <span>Estimated total</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={!items.length}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  Proceed to checkout
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/products")}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus