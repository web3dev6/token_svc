export type CreateTokenPayload = {
  name: string;
  symbol: string;
  amount: string;
  owner: string;
};
// Type guard function for CreateTokenPayload
export function isCreateTokenPayload(payload: any): payload is CreateTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'name' in payload &&
    'symbol' in payload &&
    'amount' in payload &&
    'owner' in payload
  );
}

export type MintTokenPayload = {
  tokenAddress: string;
  recipientAddress: string;
  amount: string;
};
// Type guard function for MintTokenPayload
export function isMintTokenPayload(payload: any): payload is MintTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'tokenAddress' in payload &&
    'recipientAddress' in payload &&
    'amount' in payload
  );
}

export type TransferTokenPayload = {
  tokenAddress: string;
  recipientAddress: string;
  amount: string;
};
// Type guard function for TransferTokenPayload
export function isTransferTokenPayload(payload: any): payload is TransferTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'tokenAddress' in payload &&
    'recipientAddress' in payload &&
    'amount' in payload
  );
}

export type BurnTokenPayload = {
  tokenAddress: string;
  amount: string;
};
// Type guard function for BurnTokenPayload
export function isBurnTokenPayload(payload: any): payload is BurnTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'tokenAddress' in payload &&
    'amount' in payload
  );
}
