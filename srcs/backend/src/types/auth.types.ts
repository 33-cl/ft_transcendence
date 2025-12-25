export interface RegisterBody
{
  email?: string;
  username?: string;
  password?: string;
}

export interface DbUser
{
  id: number;
  email: string;
  username: string;
  password_hash: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

export interface SessionJoinRow
{
  token: string;
  expires_at: string | null;
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}
