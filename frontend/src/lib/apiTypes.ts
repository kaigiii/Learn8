import type {
  CourseStatus,
  JobStatus,
  JobType,
  LessonSessionPhase,
  LessonSessionStatus,
  NodeStatus,
} from "@/lib/domain/statuses";

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  email: string;
  credits: number;
  xp: number;
  level: number;
  xp_to_next_level: number;
  full_name?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  education_level?: string | null;
  daily_learning_goal_minutes?: number;
}

export interface UserLedgerEvent {
  id: number;
  event_type: string;
  event_key?: string | null;
  credits_delta: number;
  xp_delta: number;
  credits_balance_after: number;
  xp_balance_after: number;
  level_after: number;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface UserLedgerResponse {
  items: UserLedgerEvent[];
  total: number;
}

export interface LessonNode {
  id: string;
  title: string;
  description: string;
  status: NodeStatus;
  hasGeneratedLesson?: boolean;
}

export interface CourseUnit {
  unitId: string;
  unitTitle: string;
  unitDescription?: string;
  nodes: LessonNode[];
}

export interface CoursePath {
  id?: number;
  topic?: string;
  courseTitle: string;
  description?: string;
  units: CourseUnit[];
}

export interface CourseListItem {
  id: number;
  title: string;
  topic: string;
  status?: CourseStatus;
  draft_json?: DraftData | null;
  folder_name?: string | null;
  created_at: string;
}

export interface LessonStage {
  stageId: string;
  topic: string;
  module: "Instruction" | "Practice" | "Assessment" | "Incentive";
  component: "MultipleChoice" | "Ordering" | "MatchingPairs" | "FeynmanMirror";
  skin: "Scientific" | "Classic" | "Code";
  config: {
    data: Record<string, unknown>;
    initialState: Record<string, unknown>;
  };
  validation: {
    type: "exact" | "regex" | "logic";
    condition: unknown;
  };
  feedback: {
    success: string;
    error: string;
  };
}

export type LessonStageComponent = LessonStage["component"];

export interface JobTicket {
  job_id: string;
  status: JobStatus;
}

export interface JobStreamEvent {
  job_id?: string;
  status: JobStatus;
  progress: number;
  message: string;
  result_data?: unknown;
}

export interface ActiveJobResponse {
  job_id: string | null;
  job_type?: JobType;
  status?: JobStatus;
  progress?: number;
  message?: string;
  result_data?: Record<string, unknown> | null;
  retryable?: boolean;
}

export interface SubmissionResponse {
  message?: string;
  nextAction: "proceed" | "review_later" | "complete";
  result: "correct" | "incorrect" | "skipped";
  recordedFailure: boolean;
  evaluation: Record<string, unknown>;
}

export interface FailedStageRecord {
  failedStage: LessonStage;
  userInput: unknown;
}

export interface LessonSessionPayload {
  sessionId: number;
  status: LessonSessionStatus;
  activePhase: LessonSessionPhase;
  rewardEligible: boolean;
  resumedSession: boolean;
  pendingFailedCount: number;
  primaryStages: LessonStage[];
  remedialStages: LessonStage[];
  activeStages: LessonStage[];
  remedialJobId?: string | null;
}

export interface LessonSessionSummary {
  sessionId: number;
  courseId?: number | null;
  nodeId: string;
  status: string;
  activePhase: LessonSessionPhase | string;
  rewardEligible: boolean;
  totalStages: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  accuracy: number;
  elapsedSeconds: number;
  elapsedLabel: string;
  xpGained: number;
}

export interface LessonAssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LessonAssistantRequest {
  userQuestion: string;
  sessionId?: number | null;
  courseId?: number | null;
  courseTopic?: string;
  courseTitle?: string;
  nodeId?: string;
  nodeTitle?: string;
  nodeDescription?: string;
  activePhase?: string;
  stageIndex?: number;
  totalStages?: number;
  currentStage?: LessonStage | null;
  conversation: LessonAssistantMessage[];
}

export interface LessonAssistantResponse {
  answer: string;
}

export interface LessonComponentManifestItem {
  name: LessonStageComponent | string;
  frontendRegistryKey: LessonStageComponent | string;
  module: LessonStage["module"] | string;
  description: string;
  allowedInRemedial: boolean;
  requiredConfigDataFields: string[];
  optionalConfigDataFields: string[];
  submissionKeys: string[];
  schemaRequirements: string;
}

export interface LessonComponentManifestResponse {
  items: LessonComponentManifestItem[];
}

export interface LessonGenerationPreferences {
  allowedComponents: string[];
}

export interface LessonGenerationPreferenceItem {
  id: number;
  courseId: number;
  nodeId?: string | null;
  allowedComponents: string[];
}

export interface LessonGenerationPreferenceListResponse {
  items: LessonGenerationPreferenceItem[];
}

export interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
}

export interface DraftData {
  topic?: string;
  questions?: Question[];
  answers?: Record<string, string>;
  freeText?: string;
}

export interface LearnerProfile {
  summary: string;
  learning_style?: string;
  experience_level?: string;
  goals?: string[];
}
