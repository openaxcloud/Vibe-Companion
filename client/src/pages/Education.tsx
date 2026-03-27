import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { 
  GraduationCap, 
  BookOpen, 
  Users, 
  Clock, 
  Star,
  PlayCircle,
  CheckCircle2,
  Award,
  Calendar,
  Search,
  Filter,
  UserCheck,
  Settings,
  BarChart3,
  FileText,
  Video,
  Code,
  Target,
  Zap,
  Globe
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Types for education data
interface Classroom {
  id: number;
  name: string;
  students: number;
  assignments: number;
  activeNow: number;
  code: string;
  teacher: string;
  description: string;
  progress: number;
  nextAssignment: string;
  dueDate: string;
}

interface Assignment {
  id: number;
  title: string;
  dueDate: string;
  submissions: number;
  totalStudents: number;
  subject: string;
  status: string;
  submitted: number;
  total: number;
}

interface Course {
  id: number;
  name: string;
  level: string;
  duration: string;
  students: number;
  completion: number;
  instructor: string;
  rating: number;
  description: string;
  price: string;
  title: string;
  topics?: string[];
  progress: number;
}

interface StudentProgress {
  id: number;
  name: string;
  avatar: string;
  completedLessons: number;
  totalLessons: number;
  progress: number;
  lastActive: string;
  grade: string;
}

interface LearningTopic {
  title: string;
  description: string;
  difficulty: string;
  duration: string;
  progress: number;
}

export default function Education() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real classroom data
  const { data: classrooms = [], isLoading: classroomsLoading } = useQuery<Classroom[]>({
    queryKey: ['/api/education/classrooms']
  });

  // Fetch assignments from API
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['/api/education/assignments']
  });

  // Fetch courses from API
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['/api/education/courses']
  });

  // Fetch student progress from API
  const { data: studentProgress = [] } = useQuery<StudentProgress[]>({
    queryKey: ['/api/education/student-progress']
  });

  const EducationDashboard = () => (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">42</p>
                <p className="text-[13px] text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-full">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-[13px] text-muted-foreground">Active Courses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-full">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">20</p>
                <p className="text-[13px] text-muted-foreground">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-full">
                <Award className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">156</p>
                <p className="text-[13px] text-muted-foreground">Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Classrooms */}
      <div className="grid grid-cols-1 lg:grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Classrooms</CardTitle>
            <CardDescription>Manage your current classes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {classrooms.map((classroom: Classroom) => (
                <div key={classroom.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{classroom.name}</h3>
                      <p className="text-[13px] text-muted-foreground">{classroom.code} • {classroom.teacher}</p>
                    </div>
                    <Badge variant="outline">{classroom.students} students</Badge>
                  </div>
                  <p className="text-[13px] text-muted-foreground mb-3">{classroom.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span>Course Progress</span>
                      <span>{classroom.progress}%</span>
                    </div>
                    <Progress value={classroom.progress} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="text-[13px]">
                      <p className="font-medium">{classroom.nextAssignment}</p>
                      <p className="text-muted-foreground">Due: {classroom.dueDate}</p>
                    </div>
                    <Button size="sm">View Class</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Assignments</CardTitle>
            <CardDescription>Track assignment submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignments.slice(0, 3).map((assignment: Assignment) => (
                <div key={assignment.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{assignment.title}</h3>
                      <p className="text-[13px] text-muted-foreground">{assignment.subject}</p>
                    </div>
                    <Badge variant={assignment.status === 'completed' ? 'default' : 'secondary'}>
                      {assignment.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[13px] mb-2">
                    <span>Submissions: {assignment.submitted}/{assignment.total}</span>
                    <span>Due: {assignment.dueDate}</span>
                  </div>
                  <Progress value={(assignment.submitted / assignment.total) * 100} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const ClassroomsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Classrooms</h2>
          <p className="text-muted-foreground">Manage your educational classes</p>
        </div>
        <Button>
          <Users className="h-4 w-4 mr-2" />
          Create Classroom
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classrooms.map((classroom: Classroom) => (
          <Card key={classroom.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{classroom.code}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">⋯</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Edit Classroom</DropdownMenuItem>
                    <DropdownMenuItem>View Analytics</DropdownMenuItem>
                    <DropdownMenuItem>Export Data</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardTitle>{classroom.name}</CardTitle>
              <CardDescription>{classroom.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[13px]">
                  <span>Progress</span>
                  <span>{classroom.progress}%</span>
                </div>
                <Progress value={classroom.progress} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                  <div>
                    <p className="text-muted-foreground">Students</p>
                    <p className="font-medium">{classroom.students}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assignments</p>
                    <p className="font-medium">{classroom.assignments}</p>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-[13px] font-medium mb-1">Next Assignment</p>
                  <p className="text-[13px] text-muted-foreground">{classroom.nextAssignment}</p>
                  <p className="text-[11px] text-muted-foreground">Due: {classroom.dueDate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const CoursesTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Available Courses</h2>
          <p className="text-muted-foreground">Browse and enroll in courses</p>
        </div>
        <div className="flex gap-2">
          <Input 
            placeholder="Search courses..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Button variant="outline">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 md:grid-cols-2 xl:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Badge variant="outline">{course.level}</Badge>
                <div className="text-right">
                  <p className="font-semibold text-[15px]">{course.price}</p>
                </div>
              </div>
              <CardTitle className="text-[15px]">{course.title}</CardTitle>
              <CardDescription>By {course.instructor}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {course.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {course.students}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {course.rating}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {(course.topics || []).map((topic, index) => (
                    <Badge key={index} variant="secondary" className="text-[11px]">
                      {topic}
                    </Badge>
                  ))}
                </div>
                
                {course.progress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span>Progress</span>
                      <span>{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} />
                  </div>
                )}
                
                <Button className="w-full">
                  {course.progress > 0 ? 'Continue Learning' : 'Enroll Now'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const StudentsTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Student Progress</h2>
          <p className="text-muted-foreground">Monitor student performance and engagement</p>
        </div>
        <Button variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          View Analytics
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {studentProgress.map((student, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{student.avatar}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-[13px] text-muted-foreground">Last active: {student.lastActive}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <div className="flex justify-between text-[13px] mb-1">
                      <span>Progress</span>
                      <span>{student.progress}%</span>
                    </div>
                    <Progress value={student.progress} />
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-4 md:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Education Center</h1>
            <p className="text-muted-foreground">Manage classrooms, courses, and student progress</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="classrooms">Classrooms</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <EducationDashboard />
          </TabsContent>

          <TabsContent value="classrooms">
            <ClassroomsTab />
          </TabsContent>

          <TabsContent value="courses">
            <CoursesTab />
          </TabsContent>

          <TabsContent value="students">
            <StudentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}