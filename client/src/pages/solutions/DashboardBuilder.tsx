import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BarChart3, PieChart, TrendingUp, CheckCircle, Database, Zap, Monitor } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";

export default function DashboardBuilder() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-[13px] font-medium bg-gradient-to-r from-indigo-500 to-blue-500 text-white border-0">
            Data Visualization Made Simple
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400 bg-clip-text text-transparent">
            Dashboard Builder
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground mb-6 sm:mb-8 px-4 sm:px-0">
            Build interactive data visualizations and analytics dashboards with AI assistance.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-dashboardbuilder-start">
                Create Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/templates?category=dashboards">
              <Button size="lg" variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-dashboardbuilder-templates">
                <Monitor className="h-4 w-4" />
                View Templates
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-visualizations">
            <div className="p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Rich Visualizations</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Charts, graphs, maps, and tables that make your data come alive.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-data">
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Connect Any Data</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Import from databases, APIs, CSV files, or enter data manually.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" data-testid="card-feature-realtime">
            <div className="p-2 sm:p-3 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Real-time Updates</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Live data feeds with automatic refresh and instant updates.
            </p>
          </Card>
        </div>

        {/* Dashboard Types */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Dashboards for Every Need</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[
              "Sales Analytics",
              "Marketing KPIs",
              "Financial Reports",
              "Project Management",
              "Customer Analytics",
              "IoT Monitoring",
              "Social Media Stats",
              "Health Metrics"
            ].map((dashType, index) => (
              <Card key={dashType} className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow" data-testid={`card-dashtype-${index}`}>
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="font-medium text-[11px] sm:text-[13px] md:text-base">{dashType}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Chart Types */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Visualization Options</h2>
          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-4" data-testid="viz-group-1">
              <div className="flex items-start gap-3">
                <PieChart className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[13px] sm:text-base">Pie & Donut Charts</h3>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground">Perfect for showing proportions and percentages</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[13px] sm:text-base">Bar & Column Charts</h3>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground">Compare values across categories</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[13px] sm:text-base">Line & Area Charts</h3>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground">Show trends and changes over time</p>
                </div>
              </div>
            </div>
            <div className="space-y-4" data-testid="viz-group-2">
              <div className="flex items-start gap-3">
                <Monitor className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[13px] sm:text-base">Heatmaps</h3>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground">Visualize data density and patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[13px] sm:text-base">Data Tables</h3>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground">Sortable, filterable data grids</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[13px] sm:text-base">KPI Cards</h3>
                  <p className="text-[11px] sm:text-[13px] text-muted-foreground">Highlight key metrics and indicators</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-6 sm:p-8 md:p-12 bg-gradient-to-r from-indigo-600/10 to-blue-600/10 border-2 border-primary/20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Transform Your Data Into Insights</h2>
            <p className="text-[13px] sm:text-base md:text-[15px] text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              Create beautiful, interactive dashboards that help you make data-driven decisions.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px]" data-testid="button-dashboardbuilder-cta">
                Start Building Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}