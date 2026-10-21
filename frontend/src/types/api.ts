export type OpportunityStage =
  | "PRIMEIRO_CONTATO"
  | "APRESENTACAO_ORCAMENTO"
  | "FOLLOW_UP"
  | "FORECAST"
  | "FECHAMENTO"
  | "PERDIDA";

export type OpportunityItem = {
  id: string;
  name: string;
  quantity: number;
  createdAt: string;
};

export type Salesperson = { id: string; name: string; createdAt?: string };

export type Opportunity = {
  id: string;
  code: string;
  companyName: string;
  stage: OpportunityStage;
  estimatedValue: string | null;
  lastContactAt: string | null;
  proposalValidUntil: string | null;
  customerEventDate: string | null;
  nextFollowUpAt: string | null;
  lossReason: string | null;
  salespersonId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  salesperson: Salesperson | null;
  items: OpportunityItem[];
};

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type PageResponse<T> = { data: T[]; meta: PageMeta };
export type OpportunityListResponse = PageResponse<Opportunity>;

export type StageTransition = {
  id: string;
  fromStage: OpportunityStage | null;
  toStage: OpportunityStage;
  reason: string | null;
  changedAt: string;
};

export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "WHATSAPP" | "OTHER";
export type Activity = {
  id: string;
  opportunityId: string;
  type: ActivityType;
  description: string;
  occurredAt: string;
  createdAt: string;
};

export type FollowUpAlertType =
  | "FOLLOW_UP_OVERDUE"
  | "CONTACT_STALE"
  | "PROPOSAL_EXPIRED"
  | "CUSTOMER_EVENT_NEAR";
export type FollowUpAlertStatus = "OPEN" | "RESOLVED";
export type FollowUpAlert = {
  id: string;
  opportunityId: string;
  type: FollowUpAlertType;
  status: FollowUpAlertStatus;
  referenceAt: string;
  createdAt: string;
  resolvedAt: string | null;
  opportunity: Pick<Opportunity, "id" | "code" | "companyName" | "stage">;
};

export type ApiErrorResponse = {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: { field: string; constraints: string[] }[];
  correlationId?: string;
  timestamp?: string;
  path?: string;
};
