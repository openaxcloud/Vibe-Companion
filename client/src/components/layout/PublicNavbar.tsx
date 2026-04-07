import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, ChevronDown, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ECodeLogo } from '@/components/ECodeLogo';

export function PublicNavbar() {
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const productItems = [
    { title: 'IDE', href: '/features', description: 'Code in your browser' },
    { title: 'Multiplayer', href: '/features#multiplayer', description: 'Code with your team' },
    { title: 'Mobile App', href: '/mobile', description: 'Code on the go' },
    { title: 'Desktop App', href: '/desktop', description: 'Code offline' },
    { title: 'AI', href: '/ai', description: 'AI-powered coding' },
    { title: 'Deployments', href: '/deployments', description: 'Host your apps' },
    { title: 'Bounties', href: '/bounties', description: 'Earn by coding' },
  ];

  const resourcesItems = [
    { title: 'Documentation', href: '/docs', description: 'Learn how to use E-Code' },
    { title: 'Blog', href: '/blog', description: 'News and updates' },
    { title: 'Community', href: '/community', description: 'Connect with developers' },
    { title: 'Templates', href: '/templates', description: 'Start from a template' },
    { title: 'Status', href: '/status', description: 'Service uptime' },
    { title: 'Forum', href: '/forum', description: 'Get help' },
  ];

  const companyItems = [
    { title: 'About', href: '/about', description: 'Our mission' },
    { title: 'Careers', href: '/careers', description: 'Join our team' },
    { title: 'Press', href: '/press', description: 'News coverage' },
    { title: 'Partners', href: '/partners', description: 'Work with us' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-responsive">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/">
              <div className="cursor-pointer">
                <ECodeLogo size="sm" />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:block">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Product</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {productItems.map((item) => (
                          <li key={item.title}>
                            <Link href={item.href} className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                              <div className="text-sm font-medium leading-none">{item.title}</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {item.description}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {resourcesItems.map((item) => (
                          <li key={item.title}>
                            <Link href={item.href} className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                              <div className="text-sm font-medium leading-none">{item.title}</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {item.description}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Company</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-3 p-4">
                        {companyItems.map((item) => (
                          <li key={item.title}>
                            <Link href={item.href} className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                              <div className="text-sm font-medium leading-none">{item.title}</div>
                              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {item.description}
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <Link href="/pricing">
                      <NavigationMenuLink className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50">
                        Pricing
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <Link href="/teams">
                      <NavigationMenuLink className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50">
                        Teams
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            
            <Button variant="ghost" onClick={() => window.location.href = '/api/login'}>
              Log in
            </Button>
            
            <Button onClick={() => window.location.href = '/api/login'} className="hidden sm:inline-flex">
              Sign up
            </Button>

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Menu</h2>
                  
                  {/* Product Section */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">Product</h3>
                    <div className="space-y-1">
                      {productItems.map((item) => (
                        <Link key={item.title} href={item.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.title}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Resources Section */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">Resources</h3>
                    <div className="space-y-1">
                      {resourcesItems.map((item) => (
                        <Link key={item.title} href={item.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.title}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Company Section */}
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">Company</h3>
                    <div className="space-y-1">
                      {companyItems.map((item) => (
                        <Link key={item.title} href={item.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.title}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Link href="/pricing">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Pricing
                      </Button>
                    </Link>
                    <Link href="/teams">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Teams
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-2 pt-4">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setTimeout(() => navigate('/auth'), 150);
                      }}
                    >
                      Log in
                    </Button>
                    <Button 
                      className="w-full"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setTimeout(() => navigate('/auth'), 150);
                      }}
                    >
                      Sign up
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}