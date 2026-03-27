import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Book, PlayCircle, Trophy, Clock, Star, 
  ChevronRight, Search, Filter, TrendingUp,
  Code, Database, Globe, Smartphone, Bot,
  Lock, CheckCircle, Circle, Play, Users
} from 'lucide-react';
import { ReplitLayout } from '@/components/layout/ReplitLayout';

export default function Learn() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const courses = [
    {
      id: 1,
      title: 'Introduction to Python',
      description: 'Learn Python from scratch with hands-on projects',
      category: 'python',
      difficulty: 'beginner',
      duration: '8 hours',
      lessons: 24,
      completedLessons: 12,
      rating: 4.8,
      students: 15420,
      instructor: 'Sarah Chen',
      thumbnail: '🐍'
    },
    {
      id: 2,
      title: 'Building Web Apps with React',
      description: 'Master React and build modern web applications',
      category: 'javascript',
      difficulty: 'intermediate',
      duration: '12 hours',
      lessons: 36,
      completedLessons: 0,
      rating: 4.9,
      students: 8930,
      instructor: 'Mike Johnson',
      thumbnail: '⚛️'
    },
    {
      id: 3,
      title: 'Data Structures & Algorithms',
      description: 'Essential CS concepts for technical interviews',
      category: 'computer-science',
      difficulty: 'advanced',
      duration: '20 hours',
      lessons: 48,
      completedLessons: 5,
      rating: 4.7,
      students: 6234,
      instructor: 'Dr. Emily Rodriguez',
      thumbnail: '🌳'
    },
    {
      id: 4,
      title: 'Mobile App Development with Flutter',
      description: 'Build cross-platform mobile apps',
      category: 'mobile',
      difficulty: 'intermediate',
      duration: '16 hours',
      lessons: 42,
      completedLessons: 0,
      rating: 4.6,
      students: 4521,
      instructor: 'Alex Kumar',
      thumbnail: '📱'
    }
  ];

  const tutorials = [
    {
      id: 1,
      title: 'Build a Discord Bot in 30 Minutes',
      category: 'python',
      duration: '30 min',
      difficulty: 'beginner',
      views: 23450,
      likes: 1823
    },
    {
      id: 2,
      title: 'Deploy Your First Website',
      category: 'web',
      duration: '15 min',
      difficulty: 'beginner',
      views: 18234,
      likes: 1456
    },
    {
      id: 3,
      title: 'Create a REST API with Node.js',
      category: 'javascript',
      duration: '45 min',
      difficulty: 'intermediate',
      views: 15678,
      likes: 1234
    }
  ];

  const achievements = [
    { name: 'First Steps', description: 'Complete your first lesson', earned: true, icon: '🚀' },
    { name: 'Week Warrior', description: 'Learn for 7 days straight', earned: true, icon: '🔥' },
    { name: 'Problem Solver', description: 'Complete 10 exercises', earned: false, icon: '💡' },
    { name: 'Course Master', description: 'Finish your first course', earned: false, icon: '🎓' }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: <Globe className="h-4 w-4" /> },
    { id: 'python', name: 'Python', icon: <Code className="h-4 w-4" /> },
    { id: 'javascript', name: 'JavaScript', icon: <Code className="h-4 w-4" /> },
    { id: 'web', name: 'Web Dev', icon: <Globe className="h-4 w-4" /> },
    { id: 'mobile', name: 'Mobile', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'data', name: 'Data Science', icon: <Database className="h-4 w-4" /> },
    { id: 'ai', name: 'AI/ML', icon: <Bot className="h-4 w-4" /> }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100';
    }
  };

  return (
    <ReplitLayout showSidebar={false}>
      <div className="container mx-auto max-w-6xl py-12 px-6" data-testid="page-learn">
        <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-learn">
          <Book className="h-8 w-8 text-primary" />
          Learn
        </h1>
        <p className="text-muted-foreground mt-2">
          Master new skills with interactive courses and tutorials
        </p>
      </div>

      {/* Learning Stats */}
      <div className="grid grid-cols-1 md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-muted-foreground">Learning Streak</p>
                <p className="text-2xl font-bold">12 days</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-muted-foreground">Courses Started</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <Book className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">48</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-muted-foreground">Achievements</p>
                <p className="text-2xl font-bold">2/8</p>
              </div>
              <Star className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="courses" className="space-y-4" data-testid="tabs-learn">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="courses" data-testid="tab-courses">Courses</TabsTrigger>
          <TabsTrigger value="tutorials" data-testid="tab-tutorials">Tutorials</TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">My Progress</TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements-learn">Achievements</TabsTrigger>
        </TabsList>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search courses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-courses"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      data-testid={`button-category-${category.id}`}
                    >
                      {category.icon}
                      <span className="ml-1">{category.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Grid */}
          <div className="grid md:grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="replit-card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{course.thumbnail}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-[15px]">{course.title}</h3>
                          <p className="text-[13px] text-muted-foreground">by {course.instructor}</p>
                        </div>
                        <Badge className={getDifficultyColor(course.difficulty)}>
                          {course.difficulty}
                        </Badge>
                      </div>
                      
                      <p className="text-[13px] text-muted-foreground mb-4">
                        {course.description}
                      </p>
                      
                      {course.completedLessons > 0 ? (
                        <div className="mb-4">
                          <div className="flex justify-between text-[13px] mb-1">
                            <span>Progress</span>
                            <span>{course.completedLessons}/{course.lessons} lessons</span>
                          </div>
                          <Progress 
                            value={(course.completedLessons / course.lessons) * 100} 
                            className="h-2"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 text-[13px] text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {course.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <Book className="h-3 w-3" />
                            {course.lessons} lessons
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {course.students.toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-[13px] font-medium">{course.rating}</span>
                          <span className="text-[13px] text-muted-foreground">
                            ({course.students.toLocaleString()} students)
                          </span>
                        </div>
                        <Button size="sm" data-testid={`button-start-course-${course.id}`}>
                          {course.completedLessons > 0 ? 'Continue' : 'Start'}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tutorials Tab */}
        <TabsContent value="tutorials" className="space-y-4">
          <div className="grid gap-4">
            {tutorials.map((tutorial) => (
              <Card key={tutorial.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <PlayCircle className="h-10 w-10 text-primary" />
                      <div>
                        <h3 className="font-semibold">{tutorial.title}</h3>
                        <div className="flex items-center gap-4 text-[13px] text-muted-foreground mt-1">
                          <Badge variant="secondary">{tutorial.category}</Badge>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {tutorial.duration}
                          </span>
                          <Badge className={getDifficultyColor(tutorial.difficulty)}>
                            {tutorial.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] text-muted-foreground">
                        {tutorial.views.toLocaleString()} views
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        {tutorial.likes.toLocaleString()} likes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Courses</CardTitle>
              <CardDescription>
                Track your progress across all enrolled courses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courses.filter(c => c.completedLessons > 0).map((course) => (
                <div key={course.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{course.thumbnail}</span>
                      <div>
                        <h4 className="font-semibold">{course.title}</h4>
                        <p className="text-[13px] text-muted-foreground">
                          Next: Lesson {course.completedLessons + 1} - Variables and Data Types
                        </p>
                      </div>
                    </div>
                    <Button size="sm">
                      Continue
                      <Play className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                  <Progress 
                    value={(course.completedLessons / course.lessons) * 100} 
                    className="h-2"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {Math.round((course.completedLessons / course.lessons) * 100)}% complete
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Learning Activity</CardTitle>
              <CardDescription>
                Your learning progress over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Learning activity chart</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Achievements</CardTitle>
              <CardDescription>
                Unlock achievements by completing courses and challenges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map((achievement, index) => (
                  <Card key={index} className={achievement.earned ? '' : 'opacity-50'}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <h4 className="font-semibold flex items-center gap-2">
                            {achievement.name}
                            {achievement.earned && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </h4>
                          <p className="text-[13px] text-muted-foreground">
                            {achievement.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>
                See how you rank among other learners this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { rank: 1, name: 'Alex Chen', points: 2450, avatar: '👨‍💻' },
                  { rank: 2, name: 'Sarah Johnson', points: 2320, avatar: '👩‍💻' },
                  { rank: 3, name: 'Mike Williams', points: 2180, avatar: '🧑‍💻' },
                  { rank: 15, name: 'You', points: 1540, avatar: '😊', isUser: true }
                ].map((user) => (
                  <div 
                    key={user.rank} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      user.isUser ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[15px]">#{user.rank}</span>
                      <span className="text-2xl">{user.avatar}</span>
                      <span className="font-medium">{user.name}</span>
                    </div>
                    <span className="font-semibold">{user.points} pts</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </ReplitLayout>
  );
}