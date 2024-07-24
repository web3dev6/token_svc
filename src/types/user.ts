export type User = {
  username: string;
  hashed_password: string;
  full_name: string;
  email: string;
  wallet_address: string;
  password_changed_at: Date;
  created_at: Date;
};
