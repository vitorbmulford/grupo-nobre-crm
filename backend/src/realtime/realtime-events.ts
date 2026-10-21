export type RealtimeEventName =
  | 'opportunity:created'
  | 'opportunity:updated'
  | 'opportunity:deleted'
  | 'opportunity:stage-changed'
  | 'activity:created'
  | 'alert:created'
  | 'alert:resolved';

export type RealtimeEventPayload = {
  opportunityId: string;
  version?: number;
  alertId?: string;
};

export const REALTIME_EVENTS: RealtimeEventName[] = [
  'opportunity:created',
  'opportunity:updated',
  'opportunity:deleted',
  'opportunity:stage-changed',
  'activity:created',
  'alert:created',
  'alert:resolved',
];
