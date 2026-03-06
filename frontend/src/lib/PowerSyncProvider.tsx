import { PowerSyncContext } from '@powersync/react';
import { PowerSyncDatabase } from '@powersync/web';
import React, { useEffect, useState } from 'react';
import { AppSchema } from './AppSchema';
import { SyncMindConnector } from './Connector';

const connector = new SyncMindConnector();

const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'syncmind.db' }
});

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    powerSync.init().then(() => {
      powerSync.connect(connector);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return <div className="loading">Initializing sync...</div>;
  }

  return (
    <PowerSyncContext.Provider value={powerSync}>
      {children}
    </PowerSyncContext.Provider>
  );
}

export { powerSync, connector };
