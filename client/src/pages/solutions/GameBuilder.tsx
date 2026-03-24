import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Gamepad2, Rocket, Sparkles, CheckCircle, Play, Code, Users } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";

export default function GameBuilder() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-[13px] font-medium bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
            Game Development Made Easy
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
            Game Builder
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground mb-6 sm:mb-8 px-4 sm:px-0">
            Design and code games with AI. From simple puzzles to complex adventures.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-gamebuilder-start">
                Create Your Game
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/showcase?type=games">
              <Button size="lg" variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-gamebuilder-examples">
                <Play className="h-4 w-4" />
                Play Examples
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-genre">
            <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Any Game Genre</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Create platformers, puzzles, RPGs, strategy games, or any genre you imagine.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-nocode">
            <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Code className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">No Coding Required</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Describe your game idea and watch as AI creates all the code and assets.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" data-testid="card-feature-multiplayer">
            <div className="p-2 sm:p-3 bg-pink-100 dark:bg-pink-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Multiplayer Support</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Build real-time multiplayer games with built-in networking and matchmaking.
            </p>
          </Card>
        </div>

        {/* Game Types */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Games You Can Create</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[
              "2D Platformers",
              "Puzzle Games",
              "Racing Games",
              "Card Games",
              "Tower Defense",
              "RPG Adventures",
              "Arcade Classics",
              "Educational Games"
            ].map((gameType, index) => (
              <Card key={gameType} className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow" data-testid={`card-gametype-${index}`}>
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="font-medium text-[11px] sm:text-[13px] md:text-base">{gameType}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Game Features */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Built-in Game Features</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Physics Engine</h3>
                  <p className="text-[13px] text-muted-foreground">Realistic physics for collisions, gravity, and movement</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Sound & Music</h3>
                  <p className="text-[13px] text-muted-foreground">AI-generated sound effects and background music</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Leaderboards</h3>
                  <p className="text-[13px] text-muted-foreground">Global high scores and player rankings</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Save System</h3>
                  <p className="text-[13px] text-muted-foreground">Automatic game progress saving and loading</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Mobile Controls</h3>
                  <p className="text-[13px] text-muted-foreground">Touch controls for mobile and tablet play</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Achievements</h3>
                  <p className="text-[13px] text-muted-foreground">Unlock system with badges and rewards</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-6 sm:p-8 md:p-12 bg-gradient-to-r from-orange-600/10 to-red-600/10 border-2 border-primary/20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Start Building Your Game</h2>
            <p className="text-[13px] sm:text-base md:text-[15px] text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              Turn your game ideas into reality. No experience needed - just imagination.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px]" data-testid="button-gamebuilder-cta">
                Build Your First Game
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}