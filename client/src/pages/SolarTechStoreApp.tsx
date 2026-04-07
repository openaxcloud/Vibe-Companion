import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  Search, 
  Star, 
  Heart,
  Filter,
  Grid,
  List,
  Plus,
  Minus,
  Zap,
  Sun,
  Battery,
  Wrench,
  Truck,
  Check,
  Info,
  ArrowRight,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  category: 'panels' | 'inverters' | 'batteries' | 'accessories' | 'kits';
  brand: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  description: string;
  specifications: Record<string, string>;
  inStock: boolean;
  stockCount: number;
  features: string[];
  warranty: string;
  efficiency?: string;
  capacity?: string;
  output?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function SolarTechStoreApp() {
  const [products] = useState<Product[]>([
    {
      id: '1',
      name: 'SolarMax Pro 400W Monocrystalline Panel',
      category: 'panels',
      brand: 'SolarMax',
      price: 299.99,
      originalPrice: 349.99,
      rating: 4.8,
      reviews: 247,
      image: '/api/placeholder/300/200?type=product',
      description: 'High-efficiency monocrystalline solar panel with exceptional performance in low-light conditions.',
      specifications: {
        'Power Output': '400W',
        'Efficiency': '21.2%',
        'Dimensions': '78.7" x 39.4" x 1.4"',
        'Weight': '44 lbs',
        'Cell Type': 'Monocrystalline PERC',
        'Frame': 'Anodized Aluminum'
      },
      inStock: true,
      stockCount: 156,
      features: ['PERC Cell Technology', 'Anti-Reflective Coating', 'IP67 Junction Box', 'PID Resistant'],
      warranty: '25 Year Performance, 12 Year Product',
      efficiency: '21.2%'
    },
    {
      id: '2',
      name: 'PowerFlow 5000W String Inverter',
      category: 'inverters',
      brand: 'PowerFlow',
      price: 1299.99,
      rating: 4.6,
      reviews: 89,
      image: '/api/placeholder/300/200?type=product',
      description: 'Advanced string inverter with built-in monitoring and rapid shutdown capabilities.',
      specifications: {
        'AC Power Output': '5000W',
        'Max DC Voltage': '600V',
        'Efficiency': '97.5%',
        'Dimensions': '16.5" x 12.6" x 6.1"',
        'Weight': '33 lbs',
        'Display': 'LED Status Indicators'
      },
      inStock: true,
      stockCount: 43,
      features: ['Built-in Monitoring', 'Rapid Shutdown', 'Weather Resistant', 'Grid-Tie Compatible'],
      warranty: '12 Year Standard, 20 Year Extended Available',
      efficiency: '97.5%'
    },
    {
      id: '3',
      name: 'EnergyVault 10kWh Lithium Battery',
      category: 'batteries',
      brand: 'EnergyVault',
      price: 7999.99,
      rating: 4.9,
      reviews: 156,
      image: '/api/placeholder/300/200?type=product',
      description: 'High-capacity lithium iron phosphate battery system for residential energy storage.',
      specifications: {
        'Capacity': '10kWh',
        'Chemistry': 'LiFePO4',
        'Cycles': '6000+ @ 80% DOD',
        'Dimensions': '48" x 22" x 10"',
        'Weight': '220 lbs',
        'Operating Temp': '-4°F to 122°F'
      },
      inStock: true,
      stockCount: 28,
      features: ['Smart BMS', 'Modular Design', 'Mobile App Control', 'Emergency Backup'],
      warranty: '10 Year Performance Warranty',
      capacity: '10kWh'
    },
    {
      id: '4',
      name: 'Complete Solar Kit 8kW Residential',
      category: 'kits',
      brand: 'SolarTech',
      price: 12999.99,
      originalPrice: 15999.99,
      rating: 4.7,
      reviews: 72,
      image: '/api/placeholder/300/200?type=product',
      description: 'Complete residential solar kit including panels, inverter, mounting hardware, and monitoring.',
      specifications: {
        'System Size': '8kW',
        'Panels Included': '20x 400W Panels',
        'Inverter': '8kW String Inverter',
        'Estimated Production': '10,000-14,000 kWh/year',
        'Roof Coverage': '~400 sq ft',
        'Installation': 'Professional Required'
      },
      inStock: true,
      stockCount: 15,
      features: ['Complete System', 'Professional Design', 'Monitoring Included', 'Permit Support'],
      warranty: 'System-wide 25 Year Warranty',
      output: '8kW'
    },
    {
      id: '5',
      name: 'Premium Mounting Rails & Hardware',
      category: 'accessories',
      brand: 'SecureMount',
      price: 199.99,
      rating: 4.5,
      reviews: 134,
      image: '/api/placeholder/300/200?type=product',
      description: 'Heavy-duty aluminum mounting rails and stainless steel hardware for secure panel installation.',
      specifications: {
        'Material': 'Anodized Aluminum Rails',
        'Hardware': 'Stainless Steel',
        'Length': '168" Rails (4 pieces)',
        'Load Rating': '50 psf',
        'Roof Types': 'Asphalt, Tile, Metal',
        'Includes': 'All mounting hardware'
      },
      inStock: true,
      stockCount: 89,
      features: ['Wind & Snow Rated', 'Universal Compatibility', 'Corrosion Resistant', 'Easy Installation'],
      warranty: '20 Year Structural Warranty'
    }
  ]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const categories = [
    { id: 'all', name: 'All Products', icon: Grid },
    { id: 'panels', name: 'Solar Panels', icon: Sun },
    { id: 'inverters', name: 'Inverters', icon: Zap },
    { id: 'batteries', name: 'Batteries', icon: Battery },
    { id: 'accessories', name: 'Accessories', icon: Wrench },
    { id: 'kits', name: 'Complete Kits', icon: Grid }
  ];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });

    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev => prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getDiscountPercentage = (price: number, originalPrice?: number) => {
    if (!originalPrice) return 0;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  };

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(cat => cat.id === category);
    return categoryData?.icon || Grid;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Categories & Cart */}
      <div className="w-80 border-r bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Sun className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">SolarTech Store</h2>
              <p className="text-[13px] text-muted-foreground">Solar Equipment & Supplies</p>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-3">Categories</h3>
          <div className="space-y-1">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Shopping Cart</h3>
            <Badge variant="secondary">{getTotalItems()}</Badge>
          </div>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">Your cart is empty</p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {cart.map((item) => (
                  <Card key={item.product.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-[13px] line-clamp-2">{item.product.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{formatCurrency(item.product.price)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-[13px] font-medium">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {cart.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-[15px]">{formatCurrency(getTotalPrice())}</span>
              </div>
              <Button className="w-full">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Checkout
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Solar Equipment Store</h1>
              <p className="text-muted-foreground">
                {filteredProducts.length} products found
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Products */}
        <ScrollArea className="flex-1 p-6">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const Icon = getCategoryIcon(product.category);
                return (
                  <Card key={product.id} className="cursor-pointer transition-all hover:shadow-lg">
                    <CardContent className="p-0">
                      <div className="relative">
                        <div className="h-48 bg-muted rounded-t-lg flex items-center justify-center">
                          <Icon className="h-16 w-16 text-muted-foreground" />
                        </div>
                        {product.originalPrice && (
                          <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                            {getDiscountPercentage(product.price, product.originalPrice)}% OFF
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-2 right-2"
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                            <p className="text-[13px] text-muted-foreground">{product.brand}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-[13px] font-medium">{product.rating}</span>
                          </div>
                          <span className="text-[13px] text-muted-foreground">({product.reviews} reviews)</span>
                        </div>

                        {product.efficiency && (
                          <div className="text-[13px] text-muted-foreground mb-2">
                            Efficiency: {product.efficiency}
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-[15px] font-bold">{formatCurrency(product.price)}</span>
                            {product.originalPrice && (
                              <span className="text-[13px] text-muted-foreground line-through ml-2">
                                {formatCurrency(product.originalPrice)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-[13px] text-green-600">In Stock</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            className="flex-1"
                            onClick={() => addToCart(product)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                      {(() => {
                        const Icon = getCategoryIcon(product.category);
                        return <Icon className="h-8 w-8 text-muted-foreground" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-[13px] text-muted-foreground">{product.brand}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-[13px]">{product.rating}</span>
                            </div>
                            <span className="text-[13px] text-muted-foreground">({product.reviews})</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[15px] font-bold">{formatCurrency(product.price)}</div>
                          {product.originalPrice && (
                            <div className="text-[13px] text-muted-foreground line-through">
                              {formatCurrency(product.originalPrice)}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                          {product.efficiency && <span>Efficiency: {product.efficiency}</span>}
                          {product.capacity && <span>Capacity: {product.capacity}</span>}
                          {product.output && <span>Output: {product.output}</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => addToCart(product)}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                          <Button variant="outline" onClick={() => setSelectedProduct(product)}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}