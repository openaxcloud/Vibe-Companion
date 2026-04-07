import React, { FC, MouseEvent } from "react";
import styled from "styled-components";

type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  currency?: string;
  onAddToCart?: (productId: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onClick?: (productId: string) => void;
  className?: string;
  isOutOfStock?: boolean;
};

const Card = styled.article`
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  border: 1px solid rgba(148, 163, 184, 0.2);
  cursor: pointer;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 35px rgba(15, 23, 42, 0.16);
    border-color: rgba(59, 130, 246, 0.6);
  }

  &:focus-within {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`;

const ImageWrapper = styled.div`
  position: relative;
  width: 100%;
  padding-top: 75%;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #e0f2fe 100%);
  overflow: hidden;
`;

const Image = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
  undefined:hover & {
    transform: scale(1.05);
  }
`;

const OutOfStockBadge = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background-color: rgba(15, 23, 42, 0.82);
  color: #e5e7eb;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  backdrop-filter: blur(6px);
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px 14px;

  @media (min-width: 768px) {
    padding: 14px 16px 16px 16px;
  }
`;

const Name = styled.h3`
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  @media (min-width: 768px) {
    font-size: 1rem;
  }
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
`;

const Price = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: #111827;

  @media (min-width: 768px) {
    font-size: 1.05rem;
  }
`;

const SecondaryText = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
`;

const AddToCartButton = styled.button<{ disabled?: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 9px;
  border-radius: 999px;
  border: none;
  outline: none;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
  min-width: 80px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease,
    opacity 0.2s ease;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.35);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgba(37, 99, 235, 0.42);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 5px 12px rgba(37, 99, 235, 0.28);
  }

  &:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: 2px;
  }

  undefined) =>
    disabled &&
    `
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
    background: #9ca3af;

    &:hover,
    &:active {
      transform: none;
      box-shadow: none;
    }
  `}
`;

const AddToCartIcon = styled.span`
  display: inline-flex;
  margin-right: 5px;

  svg {
    display: block;
  }
`;

const ClickOverlayButton = styled.button`
  position: absolute;
  inset: 0;
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  z-index: 1;
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
`;

const LeftInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const ProductCard: FC<ProductCardProps> = ({
  id,
  name,
  price,
  imageUrl,
  currency = "USD",
  onAddToCart,
  onClick,
  className,
  isOutOfStock = false,
}) => {
  const handleAddToCartClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isOutOfStock) return;
    if (onAddToCart) {
      onAddToCart(id, event);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  const formatPrice = (value: number): string => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$undefined`;
    }
  };

  return (
    <Card className={className}>
      {onClick && (
        <ClickOverlayButton
          type="button"
          aria-label={`View details for undefined`}
          onClick={handleCardClick}
        />
      )}

      <ImageWrapper aria-hidden={!imageUrl}>
        {imageUrl && (
          <Image src={imageUrl} alt={name} loading="lazy" draggable={false} />
        )}
        {isOutOfStock && <OutOfStockBadge>Out of stock</OutOfStockBadge>}
      </ImageWrapper>

      <Content>
        <Name title={name}>{name}</Name>

        <BottomRow>
          <LeftInfo>
            <Price>{formatPrice(price)}</Price>
            {isOutOfStock && <SecondaryText>Currently unavailable</SecondaryText>}
          </LeftInfo>

          {onAddToCart && (
            <AddToCartButton
              type="button"
              onClick={handleAddToCartClick}
              disabled={isOutOfStock}
              aria-label={`Add undefined to cart`}
            >
              <AddToCartIcon aria-hidden="true">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 4H17L16 10H6L5 4Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 16C8 16.5523 7.55228 17 7 17C6.44772 17 6 16.5523 6 16C6 15.4477 6.44772 15 7 15C7.55228 15 8