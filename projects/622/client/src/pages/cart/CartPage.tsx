import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Typography,
  useMediaQuery,
  Theme,
  Snackbar,
  Alert,
} from "@mui/material";
import { Add, Remove, DeleteOutline } from "@mui/icons-material";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";

type CartPageProps = {};

const CartPage: React.FC<CartPageProps> = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const {
    items,
    isLoading,
    error,
    updateItemQuantity,
    removeItem,
    syncCartWithBackend,
    clearError,
  } = useCart();

  const [isSyncing, setIsSyncing] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    let isMounted = true;

    const performSync = async () => {
      if (!isAuthenticated) return;
      try {
        setIsSyncing(true);
        await syncCartWithBackend();
      } catch (syncError) {
        if (isMounted) {
          setSnackbarMsg("Failed to sync cart with server.");
          setSnackbarSeverity("error");
          setSnackbarOpen(true);
        }
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    };

    performSync();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, syncCartWithBackend]);

  useEffect(() => {
    if (error) {
      setSnackbarMsg(error);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      clearError();
    }
  }, [error, clearError]);

  const handleQuantityChange = useCallback(
    async (productId: string, newQuantity: number) => {
      if (newQuantity < 1) return;
      try {
        await updateItemQuantity(productId, newQuantity);
        if (isAuthenticated) {
          setIsSyncing(true);
          await syncCartWithBackend();
        }
      } catch {
        setSnackbarMsg("Unable to update item quantity.");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      } finally {
        setIsSyncing(false);
      }
    },
    [updateItemQuantity, syncCartWithBackend, isAuthenticated]
  );

  const handleRemoveItem = useCallback(
    async (productId: string) => {
      try {
        await removeItem(productId);
        if (isAuthenticated) {
          setIsSyncing(true);
          await syncCartWithBackend();
        }
      } catch {
        setSnackbarMsg("Unable to remove item from cart.");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      } finally {
        setIsSyncing(false);
      }
    },
    [removeItem, syncCartWithBackend, isAuthenticated]
  );

  const handleCheckout = useCallback(() => {
    if (!items.length) {
      setSnackbarMsg("Your cart is empty.");
      setSnackbarSeverity("info");
      setSnackbarOpen(true);
      return;
    }
    navigate("/checkout");
  }, [items.length, navigate]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const handleSnackbarClose = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setSnackbarOpen(false);
  };

  if (isLoading && !items.length) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Shopping Cart
      </Typography>

      {(!items || items.length === 0) && !isLoading ? (
        <Paper
          elevation={1}
          sx={{
            p: 4,
            textAlign: "center",
            mt: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Your cart is empty
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Browse products and add them to your cart to view them here.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            onClick={() => navigate("/products")}
          >
            Continue Shopping
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
            gap: 3,
            alignItems: "flex-start",
            mt: 2,
          }}
        >
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Cart Items ({totalItems})
            </Typography>
            <Divider />

            <Box sx={{ mt: 1 }}>
              {items.map((item, index) => (
                <React.Fragment key={item.productId}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { xs: "flex-start", sm: "center" },
                      py: 2,
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      {item.imageUrl && (
                        <Box
                          component="img"
                          src={item.imageUrl}
                          alt={item.name}
                          sx={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            display: { xs: "none", sm: "block" },
                          }}
                        />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={500}>
                          {item.name}
                        </Typography>
                        {item.variant && (
                          <Typography variant="body2" color="text.secondary">
                            {item.variant}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          undefined each
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: isMobile ? "row" : "column",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.5,
                        minWidth: { xs: "100%", sm: 220 },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          borderRadius: 999,
                          border: "1px solid",
                          borderColor: "divider",
                          px: 1,
                        }}
                      >
                        <IconButton
                          size="small"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            handleQuantityChange(item.productId, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1 || isSyncing}
                        >
                          <Remove fontSize="small" />
                        </IconButton>
                        <Typography
                          variant="body1"
                          sx={{ px: 1.5, minWidth: 32, textAlign: "center" }}
                        >
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="Increase quantity"
                          onClick={() =>
                            handleQuantityChange(item.productId, item.quantity + 1)
                          }
                          disabled={isSyncing}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          minWidth: 90,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight={600}>
                          undefined
                        </Typography>
                        <IconButton
                          aria-label="Remove item"
                          onClick={() => handleRemoveItem(item.product