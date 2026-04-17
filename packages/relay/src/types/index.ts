export interface User {
  id: string;
  github_username: string;
  github_name: string | null;
  github_avatar_url: string | null;
  created_at: string;
  last_seen_at: string;
}

export interface Contact {
  id: string;
  owner_id: string;
  contact_github_username: string;
  contact_user_id: string | null;
  added_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_github_username: string;
  recipient_id: string | null;
  filename: string;
  file_size_bytes: number;
  storage_path: string;
  note: string | null;
  status: 'pending' | 'delivered' | 'saved' | 'dismissed' | 'expired';
  created_at: string;
  delivered_at: string | null;
  expires_at: string;
}

export interface AuthenticatedRequest {
  userId: string;
  githubUsername: string;
}
