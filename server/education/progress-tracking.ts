/**
 * Progress Tracking Service
 * Detailed student analytics and learning progress monitoring
 */

import { db } from '../db';
import { users, submissions, assignments, projects, files } from '@shared/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';

interface StudentProgress {
  studentId: number;
  courseId: number;
  overallProgress: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  averageGrade: number;
  timeSpent: number;
  lastActivity: Date;
  strengths: string[];
  weaknesses: string[];
  learningPath: LearningPathNode[];
}

interface LearningPathNode {
  topicId: string;
  topicName: string;
  mastery: number;
  timeSpent: number;
  exercisesCompleted: number;
  lastPracticed: Date;
}

interface CourseAnalytics {
  courseId: number;
  enrolledStudents: number;
  activeStudents: number;
  averageProgress: number;
  completionRate: number;
  topPerformers: StudentPerformance[];
  strugglingStudents: StudentPerformance[];
  topicMastery: TopicMastery[];
}

interface StudentPerformance {
  studentId: number;
  studentName: string;
  progress: number;
  grade: number;
  lastActive: Date;
}

interface TopicMastery {
  topic: string;
  averageMastery: number;
  studentsAttempted: number;
  averageTimeSpent: number;
}

interface ActivityMetrics {
  date: Date;
  activeUsers: number;
  submissionsCount: number;
  averageTimeOnPlatform: number;
  completedAssignments: number;
}

export class ProgressTrackingService {
  // Track student activity
  async trackActivity(
    studentId: number,
    projectId: number,
    activityType: 'coding' | 'reading' | 'testing' | 'debugging',
    duration: number
  ): Promise<void> {
    // Activity would be stored in activity tracking table
    // Implementation pending database schema update
  }

  // Get detailed student progress
  async getStudentProgress(
    studentId: number,
    courseId?: number
  ): Promise<StudentProgress> {
    // Get all submissions for the student
    const studentSubmissions = await db.select()
      .from(submissions)
      .where(eq(submissions.studentId, studentId));

    // Get assignments
    let courseAssignments;
    if (courseId) {
      courseAssignments = await db.select()
        .from(assignments)
        .where(eq(assignments.courseId, courseId));
    } else {
      // Get all assignments from student's courses
      // For now, get all assignments (would filter by enrollment in production)
      courseAssignments = await db.select()
        .from(assignments);
    }

    // Calculate metrics
    const completedAssignments = studentSubmissions.filter(
      s => s.status === 'graded' && (s.autoGradeScore !== null || s.manualGradeScore !== null)
    );

    const averageGrade = completedAssignments.length > 0
      ? completedAssignments.reduce((sum, s) => {
          const score = s.manualGradeScore !== null ? s.manualGradeScore : (s.autoGradeScore || 0);
          return sum + score;
        }, 0) / completedAssignments.length
      : 0;

    // Analyze strengths and weaknesses
    const { strengths, weaknesses } = await this.analyzePerformance(studentSubmissions);

    // Generate learning path
    const learningPath = await this.generateLearningPath(studentId, studentSubmissions);

    // Calculate time spent (from activity tracking)
    const timeSpent = await this.calculateTimeSpent(studentId, courseId);

    return {
      studentId,
      courseId: courseId || 0,
      overallProgress: (completedAssignments.length / courseAssignments.length) * 100,
      assignmentsCompleted: completedAssignments.length,
      totalAssignments: courseAssignments.length,
      averageGrade,
      timeSpent,
      lastActivity: new Date(), // Get from activity table
      strengths,
      weaknesses,
      learningPath
    };
  }

  // Analyze student performance to identify strengths and weaknesses
  private async analyzePerformance(
    submissions: any[]
  ): Promise<{ strengths: string[]; weaknesses: string[] }> {
    const topicScores: Map<string, number[]> = new Map();

    // Group scores by topic/category
    for (const submission of submissions) {
      if (submission.feedback) {
        // Parse feedback to extract topic performance
        const topics = this.extractTopicsFromFeedback(submission.feedback);
        
        topics.forEach(topic => {
          if (!topicScores.has(topic.name)) {
            topicScores.set(topic.name, []);
          }
          topicScores.get(topic.name)!.push(topic.score);
        });
      }
    }

    // Calculate average score per topic
    const topicAverages: { topic: string; average: number }[] = [];
    
    topicScores.forEach((scores, topic) => {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      topicAverages.push({ topic, average });
    });

    // Sort by performance
    topicAverages.sort((a, b) => b.average - a.average);

    const strengths = topicAverages
      .filter(t => t.average >= 80)
      .slice(0, 5)
      .map(t => t.topic);

    const weaknesses = topicAverages
      .filter(t => t.average < 60)
      .slice(-5)
      .map(t => t.topic);

    return { strengths, weaknesses };
  }

  // Extract topics from grading feedback
  private extractTopicsFromFeedback(feedback: string): { name: string; score: number }[] {
    // Parse structured feedback to extract topic scores
    // This would be based on the actual feedback format
    const topics: { name: string; score: number }[] = [];
    
    // Example parsing logic
    const patterns = [
      { regex: /Variables:\s*(\d+)%/, topic: 'Variables' },
      { regex: /Functions:\s*(\d+)%/, topic: 'Functions' },
      { regex: /Arrays:\s*(\d+)%/, topic: 'Arrays' },
      { regex: /Loops:\s*(\d+)%/, topic: 'Loops' },
      { regex: /OOP:\s*(\d+)%/, topic: 'Object-Oriented Programming' }
    ];

    patterns.forEach(pattern => {
      const match = feedback.match(pattern.regex);
      if (match) {
        topics.push({
          name: pattern.topic,
          score: parseInt(match[1])
        });
      }
    });

    return topics;
  }

  // Generate personalized learning path
  private async generateLearningPath(
    studentId: number,
    submissions: any[]
  ): Promise<LearningPathNode[]> {
    // Define curriculum topics
    const curriculumTopics = [
      { id: 'basics', name: 'Programming Basics', prerequisite: null },
      { id: 'control-flow', name: 'Control Flow', prerequisite: 'basics' },
      { id: 'functions', name: 'Functions', prerequisite: 'control-flow' },
      { id: 'arrays', name: 'Arrays & Lists', prerequisite: 'functions' },
      { id: 'objects', name: 'Objects & Classes', prerequisite: 'arrays' },
      { id: 'algorithms', name: 'Algorithms', prerequisite: 'objects' },
      { id: 'data-structures', name: 'Data Structures', prerequisite: 'algorithms' }
    ];

    const learningPath: LearningPathNode[] = [];

    for (const topic of curriculumTopics) {
      // Calculate mastery based on submissions related to this topic
      const topicSubmissions = submissions.filter(s => 
        s.feedback && s.feedback.toLowerCase().includes(topic.name.toLowerCase())
      );

      const mastery = topicSubmissions.length > 0
        ? topicSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / topicSubmissions.length
        : 0;

      learningPath.push({
        topicId: topic.id,
        topicName: topic.name,
        mastery,
        timeSpent: Math.floor(Math.random() * 3600), // Would come from activity tracking
        exercisesCompleted: topicSubmissions.length,
        lastPracticed: topicSubmissions.length > 0 
          ? new Date(Math.max(...topicSubmissions.map(s => new Date(s.submittedAt).getTime())))
          : new Date(0)
      });
    }

    return learningPath;
  }

  // Calculate total time spent
  private async calculateTimeSpent(
    studentId: number,
    courseId?: number
  ): Promise<number> {
    // Query activity tracking table
    // For now, return simulated value
    return Math.floor(Math.random() * 100) * 3600; // Random hours in seconds
  }

  // Get course-wide analytics
  async getCourseAnalytics(courseId: number): Promise<CourseAnalytics> {
    // Get all assignments for the course
    const courseAssignments = await db.select()
      .from(assignments)
      .where(eq(assignments.courseId, courseId));

    // Get all submissions for these assignments
    const assignmentIds = courseAssignments.map(a => a.id);
    
    // SECURITY: Use parameterized query instead of sql.raw for array values
    const courseSubmissions = assignmentIds.length > 0 
      ? await db.select()
          .from(submissions)
          .where(inArray(submissions.assignmentId, assignmentIds))
      : [];

    // Get unique student IDs from submissions (simulating enrolled students)
    const enrolledStudentIds = [...new Set(courseSubmissions.map(s => s.studentId))];
    const enrolledStudents = enrolledStudentIds.map(id => ({ student_id: id }));

    // Calculate active students (submitted in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentSubmissions = courseSubmissions.filter(s => 
      s.submittedAt && new Date(s.submittedAt) > sevenDaysAgo
    );
    
    const activeStudentIds = new Set(recentSubmissions.map(s => s.studentId));

    // Calculate average progress
    const studentProgress = new Map<number, number>();
    
    for (const student of enrolledStudents) {
      const studentSubmissions = courseSubmissions.filter(
        s => s.studentId === student.student_id && s.status === 'graded'
      );
      const progress = courseAssignments.length > 0
        ? (studentSubmissions.length / courseAssignments.length) * 100
        : 0;
      studentProgress.set(student.student_id, progress);
    }

    const progressValues = Array.from(studentProgress.values());
    const averageProgress = progressValues.length > 0
      ? progressValues.reduce((sum, p) => sum + p, 0) / progressValues.length
      : 0;

    // Get top performers and struggling students
    const studentPerformances: StudentPerformance[] = [];
    
    for (const [studentId, progress] of studentProgress) {
      const studentSubmissions = courseSubmissions.filter(
        s => s.studentId === studentId && (s.autoGradeScore !== null || s.manualGradeScore !== null)
      );
      
      const averageGrade = studentSubmissions.length > 0
        ? studentSubmissions.reduce((sum, s) => {
            const score = s.manualGradeScore !== null ? s.manualGradeScore : (s.autoGradeScore || 0);
            return sum + score;
          }, 0) / studentSubmissions.length
        : 0;

      const lastSubmission = studentSubmissions
        .filter(s => s.submittedAt !== null)
        .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime())[0];

      studentPerformances.push({
        studentId,
        studentName: `Student ${studentId}`, // Would fetch from users table
        progress,
        grade: averageGrade,
        lastActive: lastSubmission && lastSubmission.submittedAt ? new Date(lastSubmission.submittedAt) : new Date(0)
      });
    }

    studentPerformances.sort((a, b) => b.grade - a.grade);

    // Calculate topic mastery
    const topicMastery = await this.calculateTopicMastery(courseSubmissions);

    return {
      courseId,
      enrolledStudents: enrolledStudents.length,
      activeStudents: activeStudentIds.size,
      averageProgress,
      completionRate: studentProgress.size > 0 
        ? Array.from(studentProgress.values()).filter(p => p >= 100).length / studentProgress.size
        : 0,
      topPerformers: studentPerformances.slice(0, 5),
      strugglingStudents: studentPerformances.slice(-5).reverse(),
      topicMastery
    };
  }

  // Calculate topic mastery across all students
  private async calculateTopicMastery(submissions: any[]): Promise<TopicMastery[]> {
    const topicStats = new Map<string, { scores: number[]; timeSpent: number[] }>();

    // Aggregate scores by topic
    for (const submission of submissions) {
      if (submission.feedback) {
        const topics = this.extractTopicsFromFeedback(submission.feedback);
        
        topics.forEach(topic => {
          if (!topicStats.has(topic.name)) {
            topicStats.set(topic.name, { scores: [], timeSpent: [] });
          }
          
          const stats = topicStats.get(topic.name)!;
          stats.scores.push(topic.score);
          stats.timeSpent.push(Math.random() * 3600); // Would come from activity tracking
        });
      }
    }

    // Calculate averages
    const topicMastery: TopicMastery[] = [];
    
    topicStats.forEach((stats, topic) => {
      topicMastery.push({
        topic,
        averageMastery: stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length,
        studentsAttempted: stats.scores.length,
        averageTimeSpent: stats.timeSpent.reduce((a, b) => a + b, 0) / stats.timeSpent.length
      });
    });

    return topicMastery.sort((a, b) => b.averageMastery - a.averageMastery);
  }

  // Get activity metrics over time
  async getActivityMetrics(
    courseId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityMetrics[]> {
    const metrics: ActivityMetrics[] = [];
    
    // Generate daily metrics
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Get submissions for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const daySubmissions = await db.select()
        .from(submissions)
        .where(and(
          sql`assignment_id IN (SELECT id FROM assignments WHERE course_id = ${courseId})`,
          gte(submissions.submittedAt, dayStart),
          lte(submissions.submittedAt, dayEnd)
        ));

      const activeUserIds = new Set(daySubmissions.map(s => s.studentId));
      const completedCount = daySubmissions.filter(s => s.status === 'graded').length;

      metrics.push({
        date: new Date(currentDate),
        activeUsers: activeUserIds.size,
        submissionsCount: daySubmissions.length,
        averageTimeOnPlatform: Math.random() * 7200, // Would come from activity tracking
        completedAssignments: completedCount
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return metrics;
  }

  // Get personalized recommendations for a student
  async getRecommendations(studentId: number): Promise<{
    nextTopics: string[];
    practiceExercises: string[];
    studyTime: string;
  }> {
    const progress = await this.getStudentProgress(studentId);
    
    // Find topics with low mastery
    const lowMasteryTopics = progress.learningPath
      .filter(node => node.mastery < 70)
      .sort((a, b) => a.mastery - b.mastery);

    // Find topics not practiced recently
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const unpracticedTopics = progress.learningPath
      .filter(node => node.lastPracticed < oneWeekAgo)
      .sort((a, b) => a.lastPracticed.getTime() - b.lastPracticed.getTime());

    // Generate recommendations
    const nextTopics = [
      ...lowMasteryTopics.slice(0, 2).map(t => t.topicName),
      ...unpracticedTopics.slice(0, 1).map(t => t.topicName)
    ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

    const practiceExercises = lowMasteryTopics
      .slice(0, 3)
      .map(t => `Practice exercises for ${t.topicName}`);

    // Calculate recommended study time based on average progress
    const dailyStudyTime = progress.overallProgress < 50 ? '2 hours' :
                          progress.overallProgress < 80 ? '1.5 hours' : '1 hour';

    return {
      nextTopics,
      practiceExercises,
      studyTime: dailyStudyTime
    };
  }
}

// Export singleton
export const progressTracker = new ProgressTrackingService();