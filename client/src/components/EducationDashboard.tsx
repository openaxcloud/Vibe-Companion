// @ts-nocheck
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  Trophy, 
  Users, 
  Target, 
  Award,
  Clock,
  CheckCircle,
  PlayCircle,
  Star,
  TrendingUp,
  Calendar,
  MessageSquare,
  FileText,
  Code
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Course {
  id: number;
  title: string;
  description: string;
  category: 'beginner' | 'intermediate' | 'advanced' | 'certification';
  language?: string;
  duration: number; // minutes
  modules: Module[];
  enrolledCount: number;
  rating: number;
  certificateAvailable: boolean;
  prerequisites?: string[];
}

interface Module {
  id: number;
  courseId: number;
  title: string;
  lessons: Lesson[];
  quiz?: Quiz;
  project?: Project;
}

interface Lesson {
  id: number;
  moduleId: number;
  title: string;
  type: 'video' | 'text' | 'interactive' | 'code';
  duration: number;
  content: string;
  completed?: boolean;
}

interface Progress {
  courseId: number;
  userId: number;
  completedLessons: number[];
  completedModules: number[];
  completedQuizzes: number[];
  score: number;
  timeSpent: number;
  lastAccessedAt: Date;
  certificateEarned: boolean;
}

interface Classroom {
  id: number;
  name: string;
  teacherId: number;
  teacherName: string;
  students: Student[];
  assignments: Assignment[];
  announcements: Announcement[];
  code: string;
}

interface Student {
  id: number;
  username: string;
  progress: Record<number, number>; // courseId -> percentage
  joinedAt: Date;
}

interface EducationDashboardProps {
  userId?: number;
  isTeacher?: boolean;
}

export function EducationDashboard({ userId, isTeacher = false }: EducationDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);

  // Fetch courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['/api/education/courses'],
    queryFn: () => apiRequest('GET', '/api/education/courses')
  });

  // Fetch user progress
  const { data: progress = [] } = useQuery<Progress[]>({
    queryKey: ['/api/education/progress', userId],
    queryFn: () => apiRequest('GET', `/api/education/progress${userId ? `?userId=${userId}` : ''}`),
    enabled: !isTeacher
  });

  // Fetch classrooms
  const { data: classrooms = [] } = useQuery<Classroom[]>({
    queryKey: ['/api/education/classrooms'],
    queryFn: () => apiRequest('GET', '/api/education/classrooms'),
    enabled: isTeacher
  });

  // Enroll in course
  const enrollMutation = useMutation({
    mutationFn: (courseId: number) =>
      apiRequest('POST', `/api/education/courses/${courseId}/enroll`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/progress'] });
      toast({
        title: "Enrolled successfully",
        description: "You're now enrolled in the course"
      });
    }
  });

  // Complete lesson
  const completeLessonMutation = useMutation({
    mutationFn: ({ courseId, lessonId }: { courseId: number; lessonId: number }) =>
      apiRequest('POST', `/api/education/courses/${courseId}/lessons/${lessonId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/progress'] });
    }
  });

  // Create classroom
  const createClassroomMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiRequest('POST', '/api/education/classrooms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/education/classrooms'] });
      toast({
        title: "Classroom created",
        description: "Share the code with your students"
      });
    }
  });

  const getCourseProgress = (courseId: number): number => {
    const courseProgress = progress.find(p => p.courseId === courseId);
    if (!courseProgress) return 0;
    
    const course = courses.find(c => c.id === courseId);
    if (!course) return 0;
    
    const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    if (totalLessons === 0) return 0;
    
    return Math.round((courseProgress.completedLessons.length / totalLessons) * 100);
  };

  const getOverallStats = () => {
    const enrolledCourses = progress.length;
    const completedCourses = progress.filter(p => p.certificateEarned).length;
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageScore = progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / progress.length)
      : 0;

    return {
      enrolledCourses,
      completedCourses,
      totalTimeSpent,
      averageScore
    };
  };

  const stats = getOverallStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">
              {isTeacher ? 'Total Students' : 'Enrolled Courses'}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isTeacher 
                ? classrooms.reduce((sum, c) => sum + c.students.length, 0)
                : stats.enrolledCourses
              }
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isTeacher ? 'Across all classrooms' : `${stats.completedCourses} completed`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">
              {isTeacher ? 'Active Classrooms' : 'Time Spent'}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isTeacher 
                ? classrooms.length
                : `${Math.floor(stats.totalTimeSpent / 60)}h`
              }
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isTeacher ? 'Total classrooms' : `${stats.totalTimeSpent % 60}m`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">
              {isTeacher ? 'Assignments' : 'Average Score'}
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isTeacher 
                ? classrooms.reduce((sum, c) => sum + (c.assignments?.length || 0), 0)
                : `${stats.averageScore}%`
              }
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isTeacher ? 'Active assignments' : 'Across all courses'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-medium">
              {isTeacher ? 'Completion Rate' : 'Certificates'}
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isTeacher 
                ? '78%'
                : stats.completedCourses
              }
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isTeacher ? 'Average completion' : 'Earned certificates'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={isTeacher ? "classrooms" : "courses"} className="space-y-4">
        <TabsList>
          {!isTeacher && (
            <>
              <TabsTrigger value="courses">Browse Courses</TabsTrigger>
              <TabsTrigger value="my-learning">My Learning</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
            </>
          )}
          {isTeacher && (
            <>
              <TabsTrigger value="classrooms">My Classrooms</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Student Views */}
        {!isTeacher && (
          <>
            <TabsContent value="courses" className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm">All</Button>
                <Button variant="outline" size="sm">Beginner</Button>
                <Button variant="outline" size="sm">Intermediate</Button>
                <Button variant="outline" size="sm">Advanced</Button>
                <Button variant="outline" size="sm">Certification</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map(course => {
                  const courseProgress = getCourseProgress(course.id);
                  const isEnrolled = progress.some(p => p.courseId === course.id);

                  return (
                    <Card key={course.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => setSelectedCourse(course)}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-[15px]">{course.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {course.description}
                            </CardDescription>
                          </div>
                          {course.certificateAvailable && (
                            <Award className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(course.duration / 60)}h {course.duration % 60}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {course.enrolledCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            {course.rating.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <Badge variant={
                            course.category === 'beginner' ? 'secondary' :
                            course.category === 'intermediate' ? 'default' :
                            course.category === 'advanced' ? 'destructive' :
                            'outline'
                          }>
                            {course.category}
                          </Badge>
                          {course.language && (
                            <Badge variant="outline">{course.language}</Badge>
                          )}
                        </div>

                        {isEnrolled ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[13px]">
                              <span>Progress</span>
                              <span>{courseProgress}%</span>
                            </div>
                            <Progress value={courseProgress} />
                          </div>
                        ) : (
                          <Button 
                            className="w-full" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              enrollMutation.mutate(course.id);
                            }}
                          >
                            Enroll Now
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="my-learning" className="space-y-4">
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {progress.map(p => {
                    const course = courses.find(c => c.id === p.courseId);
                    if (!course) return null;

                    const progressPercentage = getCourseProgress(course.id);

                    return (
                      <Card key={p.courseId}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-[15px]">{course.title}</h3>
                              <p className="text-[13px] text-muted-foreground mt-1">
                                Last accessed: {new Date(p.lastAccessedAt).toLocaleDateString()}
                              </p>
                              
                              <div className="mt-4 space-y-3">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[13px]">
                                    <span>Overall Progress</span>
                                    <span>{progressPercentage}%</span>
                                  </div>
                                  <Progress value={progressPercentage} />
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-[13px]">
                                  <div>
                                    <p className="text-muted-foreground">Modules</p>
                                    <p className="font-medium">
                                      {p.completedModules.length}/{course.modules.length}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Time Spent</p>
                                    <p className="font-medium">
                                      {Math.floor(p.timeSpent / 60)}h {p.timeSpent % 60}m
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Score</p>
                                    <p className="font-medium">{p.score}%</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <Button 
                              variant="outline"
                              onClick={() => setSelectedCourse(course)}
                            >
                              Continue Learning
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="certificates" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {progress
                  .filter(p => p.certificateEarned)
                  .map(p => {
                    const course = courses.find(c => c.id === p.courseId);
                    if (!course) return null;

                    return (
                      <Card key={p.courseId} className="relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-orange-400/10" />
                        <CardContent className="relative p-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-500/20 rounded-full">
                              <Award className="h-8 w-8 text-yellow-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{course.title}</h3>
                              <p className="text-[13px] text-muted-foreground">
                                Completed with {p.score}% score
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button size="sm" variant="outline">
                              View Certificate
                            </Button>
                            <Button size="sm" variant="outline">
                              Share
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </TabsContent>
          </>
        )}

        {/* Teacher Views */}
        {isTeacher && (
          <>
            <TabsContent value="classrooms" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[15px] font-semibold">My Classrooms</h3>
                <Button onClick={() => {
                  const name = prompt('Enter classroom name:');
                  if (name) {
                    createClassroomMutation.mutate({ name });
                  }
                }}>
                  Create Classroom
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classrooms.map(classroom => (
                  <Card key={classroom.id} className="cursor-pointer"
                        onClick={() => setSelectedClassroom(classroom)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{classroom.name}</CardTitle>
                        <Badge variant="outline">Code: {classroom.code}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-[13px]">
                        <div>
                          <p className="text-muted-foreground">Students</p>
                          <p className="font-medium flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {classroom.students.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Assignments</p>
                          <p className="font-medium flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {classroom.assignments?.length || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Progress</p>
                          <p className="font-medium flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            78%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="students" className="space-y-4">
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {classrooms.flatMap(classroom => 
                    classroom.students.map(student => ({
                      ...student,
                      classroomName: classroom.name
                    }))
                  ).map(student => (
                    <Card key={student.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {student.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{student.username}</p>
                              <p className="text-[13px] text-muted-foreground">
                                {student.classroomName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {Object.values(student.progress).reduce((a, b) => a + b, 0) / 
                               Object.values(student.progress).length || 0}% Average
                            </p>
                            <p className="text-[13px] text-muted-foreground">
                              {Object.keys(student.progress).length} courses
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Course Completion Rates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['Introduction to Programming', 'Web Development', 'Data Science'].map((course, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-[13px]">
                            <span>{course}</span>
                            <span>{80 - i * 10}%</span>
                          </div>
                          <Progress value={80 - i * 10} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Student Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]">Active Today</span>
                        <span className="font-medium">42 students</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]">Active This Week</span>
                        <span className="font-medium">156 students</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px]">Total Enrolled</span>
                        <span className="font-medium">234 students</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}