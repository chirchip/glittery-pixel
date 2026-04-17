export interface GpConfig {
  version: number;
  auth: {
    token: string;
    github_username: string;
    github_name: string;
    expires_at: string;
  } | null;
  relay_url: string;
  preferences: {
    default_save_dir: string;
    auto_overwrite: boolean;
    notifications: boolean;
  };
}

export interface InboxMessage {
  id: string;
  filename: string;
  file_size_bytes: number;
  note: string | null;
  status: string;
  created_at: string;
  sender: {
    github_username: string;
    github_name: string | null;
  };
}

export interface ContactInfo {
  github_username: string;
  github_name: string | null;
  on_gp: boolean;
  added_at: string;
}

export interface SendResult {
  id: string;
  filename: string;
  size_bytes: number;
}

export interface HistoryItem {
  id: string;
  filename: string;
  file_size_bytes: number;
  note: string | null;
  status: string;
  created_at: string;
  recipient_github_username?: string;
  sender?: { github_username: string };
}
