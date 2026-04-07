import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Box, Button, Container, Grid, Typography, Chip, useMediaQuery, Theme, Stack, Skeleton, Paper } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import CategoryIcon from "@mui/icons-material/Category";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import StarIcon from "@mui/icons-material/Star";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { ProductGrid } from "../components/ProductGrid";
import { useProducts } from "../hooks/useProducts";
import { Category, Product } from "../types";

const HeroSection = styled("section")(({ theme }) => ({
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(10),
  [theme.breakpoints.up("md")]: {
    paddingTop: theme.spacing(10),
    paddingBottom: theme.spacing(12),
  },
}));

const HeroBackground = styled(Box)(({ theme }) => ({
  position: "absolute",
  inset: 0,
  background: `radial-gradient(circle at top left, undefined1f 0, transparent 60%), radial-gradient(circle at bottom right, undefined1f 0, transparent 60%)`,
  zIndex: -1,
  pointerEvents: "none",
}));

const CategoryCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  borderRadius: theme.shape.borderRadius * 2,
  display: "flex",
  cursor: "pointer",
  alignItems: "center",
  gap: theme.spacing(2),
  transition: "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
  border: `1px solid undefined`,
  backgroundColor: theme.palette.background.paper,
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[4],
    backgroundColor: theme.palette.action.hover,
  },
}));

const CategoryIconWrapper = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.contrastText,
  flexShrink: 0,
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  letterSpacing: "-0.02em",
}));

const AccentChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 3,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 11,
  paddingInline: theme.spacing(0.5),
}));

const HeroBadge = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1.5, 0.5, 0.5),
  borderRadius: 999,
  backgroundColor: theme.palette.mode === "light" ? "#ffffffee" : theme.palette.background.paper,
  border: `1px solid undefined`,
  boxShadow: theme.shadows[1],
}));

const BadgeIconWrapper = styled(Box)(({ theme }) => ({
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
}));

const HeroActionsWrapper = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(3),
  flexDirection: "row",
  gap: theme.spacing(2),
  alignItems: "center",
  flexWrap: "wrap",
}));

const StatsWrapper = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(4),
  direction: "row",
  flexWrap: "wrap",
  gap: theme.spacing(4),
  color: theme.palette.text.secondary,
  fontSize: 14,
}));

const StatItem = styled("div")(({ theme }) => ({
  minWidth: 120,
}));

const StatValue = styled("div")(({ theme }) => ({
  fontWeight: 700,
  fontSize: 18,
  color: theme.palette.text.primary,
}));

type HighlightCategory = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  color: "primary" | "secondary" | "default" | "success" | "info" | "warning" | "error";
};

const DEFAULT_HIGHLIGHT_CATEGORIES: HighlightCategory[] = [
  {
    id: "featured",
    label: "Featured",
    description: "Top picks curated for you",
    icon: <StarIcon fontSize="small" />,
    color: "warning",
  },
  {
    id: "deals",
    label: "Best Deals",
    description: "Limited-time offers",
    icon: <LocalOfferIcon fontSize="small" />,
    color: "secondary",
  },
  {
    id: "new",
    label: "New Arrivals",
    description: "Freshly added products",
    icon: <NewReleasesIcon fontSize="small" />,
    color: "primary",
  },
];

const HomePage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMdUp = useMediaQuery((theme: Theme) => theme.breakpoints.up("md"));
  const { products, categories, isLoading, error } = useProducts();
  const [selectedHighlight, setSelectedHighlight] = useState<string>("featured");

  const featuredProducts = useMemo<Product[]>(() => {
    if (!products || products.length === 0) return [];
    const sorted = [...products].sort((a, b) => {
      const aScore = (a.rating ?? 0) * 2 + (a.featured ? 3 : 0);
      const bScore = (b.rating ?? 0) * 2 + (b.featured ? 3 : 0);
      return bScore - aScore;
    });
    return sorted.slice(0, 8);
  }, [products]);

  const dealsProducts = useMemo<Product[]>(() => {
    if (!products || products.length === 0) return [];
    const discounted = products.filter((p) => (p.discount ?? 0) > 0);
    if (discounted.length === 0) return featuredProducts;
    const sorted = [...discounted].sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0));
    return sorted.slice(0, 8);
  }, [products, featuredProducts]);

  const newProducts = useMemo<Product[]>(() => {
    if (!products || products.length === 0) return [];
    const sorted = [...products].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
    return sorted.slice(0, 8);
  }, [products]);

  const highlightData = useMemo<Product[]>(() => {
    switch (selectedHighlight) {
      case "deals":
        return dealsProducts;
      case "new":
        return newProducts;
      case "featured":
      default:
        return featuredProducts;
    }
  }, [selectedHighlight, featuredProducts, dealsProducts, newProducts]);

  const topCategories: Category[] = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    return categories
      .slice()
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 6);
  }, [categories]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBrowseAllClick = () => {
    navigate("/products");
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/products?category=undefined`);
  };

  const handleHighlightClick = (id: string) => {
    setSelectedHighlight(id);
  };

  return (
    <Box>
      <HeroSection>
        <HeroBackground />
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>