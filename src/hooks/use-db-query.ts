import { useMemo } from 'react';

import { useDataVersion } from '@/state/dataVersion';

/**
 * Aja synkroninen tietokantakysely ja laske se uudelleen, kun data muuttuu
 * (globaali versionumero) tai annetut riippuvuudet muuttuvat.
 */
export function useDbQuery<T>(run: () => T, deps: unknown[] = []): T {
  const version = useDataVersion((s) => s.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(run, [version, ...deps]);
}
