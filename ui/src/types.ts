export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
}

export interface App {
  id: number;
  name: string;
  description: string;
  token?: string;
}

export interface Notification {
  id: number;
  app_id: number;
  app?: App;
  title: string;
  message: string;
  priority: number;
  read: boolean;
  created_at: string;
}
