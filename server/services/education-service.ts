import EventEmitter from 'events';
import { createLogger } from '../utils/logger';
import { DatabaseStorage } from '../storage';

const logger = createLogger('education-service');

export interface Classroom {
  id: number;
  name: string;
  description: string;
  students: number;
  assignments: number;
  progress: number;
  teacher: string;
  code: string;
  nextAssignment?: string;
  dueDate?: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: number;
}

export interface Student {
  id: number;
  userId: number;
  classroomId: number;
  enrolledAt: Date;
  progress: number;
  assignmentsCompleted: number;
  lastActive: Date;
}

export interface Assignment {
  id: number;
  classroomId: number;
  title: string;
  description: string;
  instructions: string;
  dueDate: Date;
  points: number;
  type: 'coding' | 'quiz' | 'project' | 'reading';
  templateProjectId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Submission {
  id: number;
  assignmentId: number;
  studentId: number;
  projectId?: number;
  content?: string;
  grade?: number;
  feedback?: string;
  submittedAt: Date;
  gradedAt?: Date;
}

export interface Course {
  id: number;
  name: string;
  description: string;
  language: string;
  framework?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  enrolled: number;
  rating: number;
  modules: number;
  certificate: boolean;
  instructor: string;
  instructorAvatar?: string;
  price: number;
  featured: boolean;
  tags: string[];
}

export class EducationService extends EventEmitter {
  private classrooms: Map<number, Classroom> = new Map();
  private students: Map<number, Student> = new Map();
  private assignments: Map<number, Assignment> = new Map();
  private submissions: Map<number, Submission> = new Map();
  private courses: Map<number, Course> = new Map();
  private enrollments: Map<string, Set<number>> = new Map(); // userId -> courseIds
  private nextId = 1;

  constructor(private storage: DatabaseStorage) {
    super();
    this.initializeCourses();
  }

  private initializeCourses() {
    const initialCourses: Course[] = [
      {
        id: 1,
        name: 'Complete Web Development Bootcamp',
        description: 'Master HTML, CSS, JavaScript, React, Node.js, and more',
        language: 'JavaScript',
        framework: 'React',
        difficulty: 'beginner',
        duration: '12 weeks',
        enrolled: 2847,
        rating: 4.8,
        modules: 24,
        certificate: true,
        instructor: 'Dr. Sarah Johnson',
        instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
        price: 0,
        featured: true,
        tags: ['Web Development', 'Full Stack', 'JavaScript', 'React']
      },
      {
        id: 2,
        name: 'Python for Data Science',
        description: 'Learn Python, Pandas, NumPy, and machine learning basics',
        language: 'Python',
        difficulty: 'intermediate',
        duration: '8 weeks',
        enrolled: 1923,
        rating: 4.9,
        modules: 16,
        certificate: true,
        instructor: 'Prof. Michael Chen',
        instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=michael',
        price: 0,
        featured: true,
        tags: ['Python', 'Data Science', 'Machine Learning', 'Analytics']
      },
      {
        id: 3,
        name: 'Mobile App Development with React Native',
        description: 'Build iOS and Android apps with React Native',
        language: 'JavaScript',
        framework: 'React Native',
        difficulty: 'intermediate',
        duration: '10 weeks',
        enrolled: 1456,
        rating: 4.7,
        modules: 20,
        certificate: true,
        instructor: 'Alex Rivera',
        instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
        price: 0,
        featured: false,
        tags: ['Mobile', 'React Native', 'iOS', 'Android']
      },
      {
        id: 4,
        name: 'Game Development with Unity',
        description: 'Create 2D and 3D games using Unity and C#',
        language: 'C#',
        framework: 'Unity',
        difficulty: 'intermediate',
        duration: '14 weeks',
        enrolled: 892,
        rating: 4.6,
        modules: 28,
        certificate: true,
        instructor: 'James Park',
        instructorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=james',
        price: 0,
        featured: false,
        tags: ['Game Development', 'Unity', 'C#', '3D Graphics']
      }
    ];

    initialCourses.forEach(course => this.courses.set(course.id, course));
    logger.info(`Education service initialized with ${this.courses.size} courses`);
  }

  // Classroom Management
  async createClassroom(data: Omit<Classroom, 'id' | 'createdAt' | 'updatedAt'>): Promise<Classroom> {
    const classroom: Classroom = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.classrooms.set(classroom.id, classroom);
    this.emit('classroom-created', classroom);
    
    logger.info(`Classroom created: ${classroom.name} (${classroom.code})`);
    return classroom;
  }

  async getClassrooms(userId: number): Promise<Classroom[]> {
    // Get classrooms where user is teacher or enrolled as student
    const userClassrooms = Array.from(this.classrooms.values()).filter(
      classroom => classroom.ownerId === userId || this.isStudentInClassroom(userId, classroom.id)
    );

    return userClassrooms;
  }

  async getClassroom(id: number): Promise<Classroom | null> {
    return this.classrooms.get(id) || null;
  }

  async updateClassroom(id: number, updates: Partial<Classroom>): Promise<Classroom | null> {
    const classroom = this.classrooms.get(id);
    if (!classroom) return null;

    const updated = {
      ...classroom,
      ...updates,
      updatedAt: new Date()
    };

    this.classrooms.set(id, updated);
    this.emit('classroom-updated', updated);
    
    return updated;
  }

  async deleteClassroom(id: number): Promise<boolean> {
    const deleted = this.classrooms.delete(id);
    if (deleted) {
      // Remove all students and assignments
      Array.from(this.students.values())
        .filter(s => s.classroomId === id)
        .forEach(s => this.students.delete(s.id));
      
      Array.from(this.assignments.values())
        .filter(a => a.classroomId === id)
        .forEach(a => this.assignments.delete(a.id));
      
      this.emit('classroom-deleted', { id });
    }
    return deleted;
  }

  // Student Management
  async enrollStudent(userId: number, classroomId: number): Promise<Student> {
    const existing = Array.from(this.students.values()).find(
      s => s.userId === userId && s.classroomId === classroomId
    );
    
    if (existing) return existing;

    const student: Student = {
      id: this.nextId++,
      userId,
      classroomId,
      enrolledAt: new Date(),
      progress: 0,
      assignmentsCompleted: 0,
      lastActive: new Date()
    };

    this.students.set(student.id, student);
    
    // Update classroom student count
    const classroom = this.classrooms.get(classroomId);
    if (classroom) {
      classroom.students++;
      this.classrooms.set(classroomId, classroom);
    }

    this.emit('student-enrolled', student);
    logger.info(`Student ${userId} enrolled in classroom ${classroomId}`);
    
    return student;
  }

  async getClassroomStudents(classroomId: number): Promise<Student[]> {
    return Array.from(this.students.values()).filter(s => s.classroomId === classroomId);
  }

  private isStudentInClassroom(userId: number, classroomId: number): boolean {
    return Array.from(this.students.values()).some(
      s => s.userId === userId && s.classroomId === classroomId
    );
  }

  // Assignment Management
  async createAssignment(data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Assignment> {
    const assignment: Assignment = {
      ...data,
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.assignments.set(assignment.id, assignment);
    
    // Update classroom assignment count
    const classroom = this.classrooms.get(data.classroomId);
    if (classroom) {
      classroom.assignments++;
      this.classrooms.set(data.classroomId, classroom);
    }

    this.emit('assignment-created', assignment);
    logger.info(`Assignment created: ${assignment.title} for classroom ${assignment.classroomId}`);
    
    return assignment;
  }

  async getClassroomAssignments(classroomId: number): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).filter(a => a.classroomId === classroomId);
  }

  async submitAssignment(
    assignmentId: number,
    studentId: number,
    data: { projectId?: number; content?: string }
  ): Promise<Submission> {
    const submission: Submission = {
      id: this.nextId++,
      assignmentId,
      studentId,
      projectId: data.projectId,
      content: data.content,
      submittedAt: new Date()
    };

    this.submissions.set(submission.id, submission);
    
    // Update student progress
    const student = this.students.get(studentId);
    if (student) {
      student.assignmentsCompleted++;
      student.lastActive = new Date();
      
      // Calculate progress based on completed assignments
      const totalAssignments = Array.from(this.assignments.values())
        .filter(a => a.classroomId === student.classroomId).length;
      
      if (totalAssignments > 0) {
        student.progress = Math.round((student.assignmentsCompleted / totalAssignments) * 100);
      }
      
      this.students.set(studentId, student);
    }

    this.emit('assignment-submitted', submission);
    
    return submission;
  }

  async gradeSubmission(
    submissionId: number,
    grade: number,
    feedback?: string
  ): Promise<Submission | null> {
    const submission = this.submissions.get(submissionId);
    if (!submission) return null;

    submission.grade = grade;
    submission.feedback = feedback;
    submission.gradedAt = new Date();

    this.submissions.set(submissionId, submission);
    this.emit('submission-graded', submission);
    
    return submission;
  }

  // Course Management
  async getCourses(filters?: {
    language?: string;
    difficulty?: string;
    search?: string;
  }): Promise<Course[]> {
    let courses = Array.from(this.courses.values());

    if (filters) {
      if (filters.language) {
        courses = courses.filter(c => c.language === filters.language);
      }
      if (filters.difficulty) {
        courses = courses.filter(c => c.difficulty === filters.difficulty);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        courses = courses.filter(c =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower) ||
          c.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
    }

    return courses;
  }

  async enrollInCourse(userId: string, courseId: number): Promise<void> {
    if (!this.enrollments.has(userId)) {
      this.enrollments.set(userId, new Set());
    }

    this.enrollments.get(userId)!.add(courseId);
    
    const course = this.courses.get(courseId);
    if (course) {
      course.enrolled++;
      this.emit('course-enrolled', { userId, courseId });
    }
  }

  async getUserCourses(userId: string): Promise<Course[]> {
    const userCourseIds = this.enrollments.get(userId) || new Set();
    return Array.from(userCourseIds)
      .map(id => this.courses.get(id))
      .filter(course => course !== undefined) as Course[];
  }

  // Analytics
  async getClassroomAnalytics(classroomId: number): Promise<{
    totalStudents: number;
    averageProgress: number;
    assignmentsCompleted: number;
    totalAssignments: number;
    activeStudents: number;
  }> {
    const students = await this.getClassroomStudents(classroomId);
    const assignments = await this.getClassroomAssignments(classroomId);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeStudents = students.filter(s => s.lastActive > weekAgo).length;
    const totalProgress = students.reduce((sum, s) => sum + s.progress, 0);
    const totalCompleted = students.reduce((sum, s) => sum + s.assignmentsCompleted, 0);

    return {
      totalStudents: students.length,
      averageProgress: students.length > 0 ? Math.round(totalProgress / students.length) : 0,
      assignmentsCompleted: totalCompleted,
      totalAssignments: assignments.length,
      activeStudents
    };
  }
}

// Export singleton instance
let educationServiceInstance: EducationService | null = null;

export function getEducationService(storage: DatabaseStorage): EducationService {
  if (!educationServiceInstance) {
    educationServiceInstance = new EducationService(storage);
  }
  return educationServiceInstance;
}