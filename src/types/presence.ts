export type PresenceUser = {
  id: number;
  email: string;
  entra_user_id: string | null;
  ringcentral_extension_id?: string | null;

  current_teams_status: string | null;
  current_ringcentral_status: string | null;

  last_sync_at: string | null;
  last_error: string | null;
};

export type SyncRuntime = {
  id: number;
  last_cron_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

export type GraphPresence = {
  id: string;
  availability: string;
  activity: string;
};
