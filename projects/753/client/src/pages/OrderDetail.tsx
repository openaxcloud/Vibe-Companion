import React, { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  useTheme,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { useNavigate, useParams } from "react-router-dom";

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

interface Address {
  fullName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface PaymentInfo {
  method: string;
  maskedCard?: string;
  status: string;
}

interface ShippingInfo {
  method: string;
  cost: number;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  items: OrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  paymentInfo?: PaymentInfo;
  shippingInfo?: ShippingInfo;
}

const mockOrder: Order = {
  id: "ORD-2024-000123",
  createdAt: "2024-12-10T14:32:00Z",
  status: "PROCESSING",
  total: 156.45,
  subtotal: 130.0,
  tax: 12.45,
  shipping: 14.0,
  items: [
    {
      id: "item-1",
      name: "Wireless Noise-Cancelling Headphones",
      sku: "HD-1001-BLK",
      quantity: 1,
      price: 98.0,
      imageUrl: "https://via.placeholder.com/80x80.png?text=Headphones",
    },
    {
      id: "item-2",
      name: "USB-C Fast Charging Cable (2m)",
      sku: "CB-2002-WHT",
      quantity: 2,
      price: 16.0,
      imageUrl: "https://via.placeholder.com/80x80.png?text=Cable",
    },
  ],
  shippingAddress: {
    fullName: "John Doe",
    street: "123 Market Street",
    city: "San Francisco",
    state: "CA",
    postalCode: "94103",
    country: "USA",
    phone: "+1 (555) 123-4567",
  },
  billingAddress: {
    fullName: "John Doe",
    street: "123 Market Street",
    city: "San Francisco",
    state: "CA",
    postalCode: "94103",
    country: "USA",
  },
  paymentInfo: {
    method: "Credit Card",
    maskedCard: "•••• •••• •••• 4242",
    status: "Paid",
  },
  shippingInfo: {
    method: "Standard Shipping",
    cost: 14.0,
    trackingNumber: "1Z999AA10123456784",
    estimatedDelivery: "Dec 18, 2024",
  },
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const formatDate = (isoDate: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));

const getStatusChipProps = (
  status: OrderStatus,
  theme: ReturnType<typeof useTheme>
): { label: string; color: "default" | "primary" | "success" | "error" | "warning"; icon: React.ReactNode } => {
  switch (status) {
    case "PENDING":
      return {
        label: "Pending",
        color: "warning",
        icon: <AccessTimeIcon fontSize="small" />,
      };
    case "PROCESSING":
      return {
        label: "Processing",
        color: "primary",
        icon: <MoreHorizIcon fontSize="small" />,
      };
    case "SHIPPED":
      return {
        label: "Shipped",
        color: "primary",
        icon: <LocalShippingIcon fontSize="small" />,
      };
    case "DELIVERED":
      return {
        label: "Delivered",
        color: "success",
        icon: <CheckCircleIcon fontSize="small" />,
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        color: "error",
        icon: <CancelIcon fontSize="small" />,
      };
    default:
      return {
        label: status,
        color: "default",
        icon: null,
      };
  }
};

const OrderDetail: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const order: Order = useMemo(() => {
    // In a real app, you would fetch by orderId; using mock for now
    return {
      ...mockOrder,
      id: orderId || mockOrder.id,
    };
  }, [orderId]);

  const statusChip = getStatusChipProps(order.status, theme);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <IconButton edge="start" onClick={() => navigate(-1)} aria-label="Back to orders">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={600}>
          Order Details
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              avatar={<ReceiptLongIcon color="primary" />}
              title={
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                  <Typography variant="h6" fontWeight={600}>
                    Order {order.id}
                  </Typography>
                  <Chip
                    size="small"
                    variant="filled"
                    color={statusChip.color}
                    icon={statusChip.icon}
                    label={statusChip.label}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                  />
                </Stack>
              }
              subheader={
                <Typography variant="body2" color="text.secondary">
                  Placed on {formatDate(order.createdAt)}
                </Typography>
              }
            />
            <Divider />
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ShoppingBagIcon fontSize="small" color="action" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Items ({order.items.length})
                  </Typography>
                </Stack>
                <List disablePadding>
                  {order.items.map((item) => (
                    <React.Fragment key={item.id}>
                      <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.5 }}>
                        <Stack direction="row" spacing={2} width="100%">
                          <Box
                            component="img"
                            src={item.imageUrl}
                            alt={item.name}
                            sx={{
                              width: 64,
                              height: 64,
                              borderRadius: 1,
                              border: `1px solid undefined`,
                              objectFit: "cover",
                              bgcolor: "background.default",
                            }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight={500}>
                              {item.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              SKU: {item.sku}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Qty: {item.quantity}
                            </Typography>
                          </Box>
                          <Stack alignItems="flex-end" justifyContent="space-between">
                            <Typography variant="subtitle1" fontWeight={600}>
                              {formatCurrency(item.price * item.quantity)}
                            </Typography>
                            <Typography variant="