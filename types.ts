
export type Tab = 'chat' | 'voice' | 'visualize' | 'solve' | 'explore' | 'lessons' | 'assignments';

export type GradeLevel = 
  | 'Elementary School' 
  | 'Middle School' 
  | 'High School' 
  | 'University' 
  | 'Professional/Research';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  groundingUrls?: Array<{ uri: string; title: string }>;
  images?: string[];
  thinking?: string;
}

export enum MathTopic {
  BASIC_MATH = 'Basic Math',
  ALGEBRA = 'Algebra',
  GEOMETRY = 'Geometry',
  TRIGONOMETRY = 'Trigonometry',
  CALCULUS = 'Calculus',
  STATISTICS = 'Statistics',
  LINEAR_ALGEBRA = 'Linear Algebra',
  DISCRETE_MATH = 'Discrete Math'
}

export interface Question {
  id: number;
  text: string;
  hint: string;
  userAnswer?: string;
  feedback?: string;
  isCorrect?: boolean;
}

export interface LearningProfile {
  gradeLevel: GradeLevel;
  topic: MathTopic;
}
