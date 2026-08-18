export interface CalendarProviderEvent {
  externalId: string;
  calendarId?: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  attendees?: string[];
  status?: "confirmed" | "tentative" | "cancelled";
  relationshipId?: string;
  propertyId?: string;
  sourceEmailMessageId?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  attendees?: string[];
  relationshipId?: string;
  propertyId?: string;
  sourceEmailMessageId?: string;
}

export interface CalendarAdapter {
  readonly provider: string;
  listEvents(orgId: string, input: { startAt: string; endAt: string }): Promise<CalendarProviderEvent[]>;
  createEvent(orgId: string, input: CreateCalendarEventInput): Promise<CalendarProviderEvent>;
  updateEvent(orgId: string, externalId: string, patch: Partial<CreateCalendarEventInput>): Promise<CalendarProviderEvent>;
  cancelEvent(orgId: string, externalId: string): Promise<void>;
}

/**
 * Calendar adapters are intentionally separate from OpenRabbit's planning
 * kernel. The planning layer represents the user's operating timeline;
 * provider adapters synchronize selected plan items with Google, Microsoft,
 * or future calendar systems.
 */
