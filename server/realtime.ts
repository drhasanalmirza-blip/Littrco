export interface RealtimeAdapter {
  sendArmVeriScan(
    binId: number,
    sessionId: number,
    expiresAt: Date,
    expectedCount: number,
  ): Promise<void>;

  sendRewardUpdate(
    binId: number,
    dropId: number,
    status: string,
    points: number,
  ): Promise<void>;
}

export const noOpAdapter: RealtimeAdapter = {
  async sendArmVeriScan(binId, sessionId, expiresAt, expectedCount) {
    console.log(
      `[Realtime/NoOp] sendArmVeriScan binId=${binId} sessionId=${sessionId} expiresAt=${expiresAt.toISOString()} expectedCount=${expectedCount}`,
    );
  },

  async sendRewardUpdate(binId, dropId, status, points) {
    console.log(
      `[Realtime/NoOp] sendRewardUpdate binId=${binId} dropId=${dropId} status=${status} points=${points}`,
    );
  },
};

let currentAdapter: RealtimeAdapter = noOpAdapter;

export function getRealtimeAdapter(): RealtimeAdapter {
  return currentAdapter;
}

export function setRealtimeAdapter(adapter: RealtimeAdapter): void {
  currentAdapter = adapter;
}
