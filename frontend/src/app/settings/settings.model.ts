export interface AppSettings {
  displayName: string;
  contextualMessagesEnabled: boolean;
  updatedAt: string | null;
}

export interface UpdateSettingsRequest {
  displayName: string;
  contextualMessagesEnabled: boolean;
}
