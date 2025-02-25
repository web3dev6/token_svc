import { User } from "./user";

export type Transaction = {
  id: bigint;
  username: string;
  context: string;
  payload: any;
  is_confirmed: boolean;
  status: string;
  created_at: Date;
  users: User;
};
