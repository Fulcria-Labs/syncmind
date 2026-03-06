import { v4 as uuid } from 'uuid';
import type { PowerSyncBackendConnector } from '@powersync/web';
import { type AbstractPowerSyncDatabase } from '@powersync/web';

const USER_ID_KEY = 'syncmind_user_id';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:6061';
const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL || 'http://localhost:8089';

export class SyncMindConnector implements PowerSyncBackendConnector {
  readonly userId: string;

  constructor() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = uuid();
      localStorage.setItem(USER_ID_KEY, userId);
    }
    this.userId = userId;
  }

  async fetchCredentials() {
    const res = await fetch(`${BACKEND_URL}/api/auth/token?user_id=${this.userId}`);
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const body = await res.json();
    return {
      endpoint: POWERSYNC_URL,
      token: body.token
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      const batch = transaction.crud.map(op => ({
        op: op.op,
        table: op.table,
        id: op.id,
        data: op.opData
      }));

      const response = await fetch(`${BACKEND_URL}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      await transaction.complete();
    } catch (ex) {
      console.error('Upload error:', ex);
      throw ex;
    }
  }
}
