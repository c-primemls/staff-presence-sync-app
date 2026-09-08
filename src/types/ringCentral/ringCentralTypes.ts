export type RingCentralPresence = {
  presenceStatus?: string;
  telephonyStatus?: string;
  userStatus?: string;
  dndStatus?: string;
  meetingStatus?: string;
};

export type RingCentralSubscription = {
  id: string;
  status?: string;
  creationTime?: string;
  expirationTime?: string;
  expiresIn?: number;
  eventFilters?: string[];
};
