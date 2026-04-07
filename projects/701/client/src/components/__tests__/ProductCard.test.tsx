import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Provider } from "react-redux";
import configureStore, { MockStoreEnhanced } from "redux-mock-store";
import thunk from "redux-thunk";
import { AnyAction, Store } from "redux";
import ProductCard from "../ProductCard";

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
}

interface CartState {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

interface RootState {
  cart: CartState;
}

const mockStore = configureStore<RootState, AnyAction>([thunk]);

const renderWithStore = (
  ui: React.ReactElement,
  {
    initialState,
    store = mockStore(initialState as RootState),
  }: { initialState?: Partial<RootState>; store?: MockStoreEnhanced<RootState, AnyAction> } = {}
) => {
  return {
    ...render(<Provider store={store as unknown as Store<RootState, AnyAction>}>{ui}</Provider>),
    store,
  };
};

describe("ProductCard", () => {
  const baseProduct: Product = {
    id: "prod-1",
    name: "Test Product",
    price: 19.99,
    imageUrl: "https://example.com/image.jpg",
    description: "A great product",
  };

  test("renders product name, price, image, and description", () => {
    render(<ProductCard product={baseProduct} onAddToCart={jest.fn()} />);

    expect(screen.getByText(baseProduct.name)).toBeInTheDocument();
    expect(screen.getByText(`$undefined`)).toBeInTheDocument();

    if (baseProduct.description) {
      expect(screen.getByText(baseProduct.description)).toBeInTheDocument();
    }

    if (baseProduct.imageUrl) {
      const image = screen.getByAltText(baseProduct.name) as HTMLImageElement;
      expect(image).toBeInTheDocument();
      expect(image.src).toBe(baseProduct.imageUrl);
    }
  });

  test("calls onAddToCart handler when button is clicked if provided", () => {
    const handleAddToCart = jest.fn();

    render(<ProductCard product={baseProduct} onAddToCart={handleAddToCart} />);

    const button = screen.getByRole("button", { name: /add to cart/i });
    fireEvent.click(button);

    expect(handleAddToCart).toHaveBeenCalledTimes(1);
    expect(handleAddToCart).toHaveBeenCalledWith(baseProduct);
  });

  test("dispatches to store when no onAddToCart handler is provided", () => {
    const initialState: RootState = {
      cart: {
        items: [],
      },
    };

    const { store } = renderWithStore(<ProductCard product={baseProduct} />, {
      initialState,
    });

    const button = screen.getByRole("button", { name: /add to cart/i });
    fireEvent.click(button);

    const actions = store.getActions();
    expect(actions.length).toBeGreaterThan(0);

    const addToCartAction = actions.find(
      (action) =>
        (action.type === "cart/addItem" || action.type === "ADD_TO_CART") &&
        (action.payload?.id === baseProduct.id || action.payload?.productId === baseProduct.id)
    );

    expect(addToCartAction).toBeDefined();
  });

  test("shows disabled state on button when product is out of stock if such prop exists", () => {
    const productOutOfStock: Product & { inStock?: boolean } = {
      ...baseProduct,
      inStock: false,
    };

    render(
      // @ts-expect-error - inStock may not exist on ProductCard props but we test conditional behavior if implemented
      <ProductCard product={productOutOfStock} onAddToCart={jest.fn()} />
    );

    const button = screen.getByRole("button", { name: /add to cart/i });
    expect(button).toBeDisabled();
  });

  test("renders without optional fields (image and description)", () => {
    const minimalProduct: Product = {
      id: "prod-2",
      name: "Minimal Product",
      price: 9.99,
    };

    render(<ProductCard product={minimalProduct} onAddToCart={jest.fn()} />);

    expect(screen.getByText(minimalProduct.name)).toBeInTheDocument();
    expect(screen.getByText(`$undefined`)).toBeInTheDocument();

    expect(screen.queryByAltText(minimalProduct.name)).not.toBeInTheDocument();
    expect(screen.queryByText(/a great product/i)).not.toBeInTheDocument();
  });
});