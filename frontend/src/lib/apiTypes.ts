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
  preferred_language?: string | null;
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
  isPublic?: boolean;
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
  component: "MultipleChoice" | "Ordering" | "MatchingPairs" | "FeynmanMirror" | "ExplainerMedia";
  skin: "Scientific" | "Classic" | "Code";
  difficulty?: "low" | "medium" | "high" | null;
  recommendedDurationMinutes?: number | null;
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

export interface ArenaPublicCourse {
  id: number; // Course ID
  poolId: number;
  slug: string;
  title: string; // Pool Title
  courseTitle: string;
  topic: string;
  description?: string | null;
  isFeatured: boolean;
  tags: string[];
}

export interface ArenaCompetitiveQueueState {
  queueId: number;
  status: string;
  publicCourseId: number;
  publicCourseTitle: string;
  poolId?: number | null;
  poolTitle?: string | null;
  mode: string;
  queuedAt: string;
  expiresAt?: string | null;
  matchId?: number | null;
  matchedUserId?: number | null;
}

export interface ArenaAdminPublicCourse extends ArenaPublicCourse {
  isPublished: boolean;
}

export interface ArenaAdminSyllabusQuestion {
  unitId: string;
  unitTitle: string;
  nodeId: string;
  nodeTitle: string;
  questionKey: string;
  questionType: string;
  prompt: string;
  options: any[];
  correctOptionId?: string;
  difficulty: string;
  explanation?: string | null;
}

export interface ArenaAdminPublicCourseUpsertRequest {
  slug: string;
  title: string;
  topic: string;
  description?: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  tags: string[];
}

export interface ArenaAdminQuestionPoolItem {
  id: number;
  questionKey: string;
  questionType: string;
  prompt: string;
  options: any[];
  correctOptionId?: string;
  difficulty: string;
  knowledgeTags: string[];
  explanation?: string | null;
  sourceUnitId?: string | null;
  sourceNodeId?: string | null;
  isActive: boolean;
}

export interface ArenaAdminQuestionPool {
  id: number;
  publicCourseId: number;
  slug: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  items: ArenaAdminQuestionPoolItem[];
}

export interface ArenaAdminQuestionPoolItemUpsertRequest {
  questionKey: string;
  questionType: string;
  prompt: string;
  options: any[];
  correctOptionId?: string;
  difficulty: string;
  knowledgeTags: string[];
  explanation?: string | null;
  sourceUnitId?: string | null;
  sourceNodeId?: string | null;
  isActive: boolean;
}

export interface ArenaAdminQuestionPoolUpsertRequest {
  publicCourseId: number;
  slug: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  items: ArenaAdminQuestionPoolItemUpsertRequest[];
}

export interface ArenaAdminSeason {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  leaderboardConfig: Record<string, unknown>;
  rewardConfig: Record<string, unknown>;
}

export interface ArenaAdminSeasonUpsertRequest {
  name: string;
  status: string;
  isActive: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  leaderboardConfig: Record<string, unknown>;
  rewardConfig: Record<string, unknown>;
}

export interface ArenaAdminPlayerMatchRecord {
  matchId: number;
  userId: number;
  displayName: string;
  email: string;
  publicCourseTitle: string;
  mode: string;
  status: string;
  finalRank?: number | null;
  score: number;
  correctCount: number;
  incorrectCount: number;
  ratingDelta: number;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface ArenaAdminMatchReview {
  matchId: number;
  publicCourseTitle: string;
  mode: string;
  status: string;
  playerCount: number;
  roundCount: number;
  answerCount: number;
  timedOutCount: number;
  anomalyFlags: string[];
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface ArenaAdminHealthSnapshot {
  waitingQueueCount: number;
  matchedQueueCount: number;
  inProgressMatchCount: number;
  staleMatchCount: number;
  abandonmentCount: number;
  suspiciousLatencyCount: number;
  disconnectInstabilityCount: number;
  alertFlags: string[];
  generatedAt: string;
}

export interface ArenaSeasonSummary {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface ArenaRoomPlayer {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  isHost: boolean;
  isReady: boolean;
  team?: string | null;
  joinedAt: string;
  connectionState?: string | null;
}

export interface ArenaRoom {
  roomCode: string;
  hostUserId: number;
  publicCourseId: number;
  publicCourseTitle: string;
  poolId: number;
  poolTitle?: string | null;
  mode: string;
  visibility: string;
  status: string;
  maxPlayers: number;
  roundCount: number;
  roundTimeSeconds: number;
  playerCount: number;
  canStart: boolean;
  players: ArenaRoomPlayer[];
  latestMatchId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArenaQuestionOption {
  id: string;
  text: string;
}

export interface ArenaQuestionView {
  questionId: string;
  questionType: string;
  prompt: string;
  options: any[];
  difficulty?: string | null;
  knowledgeTags: string[];
}

export interface ArenaStandingEntry {
  userId: number;
  displayName: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  answeredCount: number;
  averageResponseMs?: number | null;
  rank: number;
  accuracy?: number | null;
  xpGained?: number | null;
  creditsGained?: number | null;
  ratingDelta?: number | null;
  ratingBefore?: number | null;
  ratingAfter?: number | null;
  rankTierBefore?: string | null;
  rankTierAfter?: string | null;
}

export interface ArenaRoundState {
  roundId: number;
  roundIndex: number;
  status: string;
  timerSeconds: number;
  startedAt?: string | null;
  deadlineAt?: string | null;
  revealedAnswer?: Record<string, unknown> | null;
  question: ArenaQuestionView;
  submittedPlayerIds: number[];
  hasSubmitted: boolean;
}

export interface ArenaPresenceState {
  userId: number;
  displayName?: string | null;
  avatarUrl?: string | null;
  connectionState: string;
  lastSeenAt?: string | null;
  disconnectedAt?: string | null;
  disconnectCount: number;
  suspectedAbandonment: boolean;
  isAccepted: boolean;
}

export interface ArenaMatchState {
  matchId: number;
  roomCode?: string | null;
  status: string;
  mode: string;
  publicCourseId: number;
  publicCourseTitle: string;
  poolId?: number | null;
  poolTitle?: string | null;
  totalRounds: number;
  currentRoundIndex: number;
  activeRound?: ArenaRoundState | null;
  standings: ArenaStandingEntry[];
  currentPlayerResult?: ArenaStandingEntry | null;
  presenceStates: ArenaPresenceState[];
  startedAt?: string | null;
  deadlineAt?: string | null;
  endedAt?: string | null;
}

export interface ArenaAnswerSubmitResponse {
  accepted: boolean;
  alreadySubmitted: boolean;
  roundClosed: boolean;
  matchFinished: boolean;
  state: ArenaMatchState;
}

export interface ArenaProfileTopicRating {
  publicCourseId: number;
  title: string;
  topic: string;
  rating: number;
  rankTier: string;
}

export interface ArenaProfile {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  rating: number;
  rankTier: string;
  bestRankTier: string;
  wins: number;
  losses: number;
  draws: number;
  rankedMatches: number;
  winRate: number;
  activeSeason?: string | null;
  seasonPlacement?: number | null;
  seasonPercentile?: number | null;
  seasonBadge?: string | null;
  seasonTitle?: string | null;
  topicRatings: ArenaProfileTopicRating[];
}

export interface ArenaLeaderboardEntry {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  rating: number;
  rankTier: string;
  wins: number;
  losses: number;
  rankedMatches: number;
  seasonPlacement?: number | null;
  seasonPercentile?: number | null;
  seasonBadge?: string | null;
  seasonTitle?: string | null;
}

export interface ArenaLeaderboardResponse {
  items: ArenaLeaderboardEntry[];
}

export interface ArenaRankHistoryEntry {
  matchId?: number | null;
  seasonId?: number | null;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  rankTierBefore: string;
  rankTierAfter: string;
  createdAt: string;
}

export interface ArenaRankHistoryResponse {
  items: ArenaRankHistoryEntry[];
}

export interface ArenaEventEnvelope {
  cursor: number;
  eventId: string;
  streamType: string;
  roomCode?: string | null;
  matchId?: number | null;
  eventType: string;
  version: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ArenaEventListResponse {
  items: ArenaEventEnvelope[];
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
