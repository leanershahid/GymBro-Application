// Pure route helpers (no screens), so the area routers and their tests can import them cheaply.
import { idSegment } from '../../navigation/paths';

/** Member (and trainer) area: report a problem, my reports, one report. */
export type FacilitiesMemberRoute =
  | { id: 'report-problem' }
  | { id: 'my-reports' }
  | { id: 'my-report'; reportId: number };

export const FACILITIES_MEMBER_IDS = ['report-problem', 'my-reports', 'my-report'] as const;
export type FacilitiesMemberRouteId = typeof FACILITIES_MEMBER_IDS[number];

export const isFacilitiesRouteId = (s: string): s is FacilitiesMemberRouteId => (FACILITIES_MEMBER_IDS as readonly string[]).includes(s);

/** The route a path names, or null. URL: /member/report-problem, /member/my-reports, /member/my-report/{id}. */
export function facilitiesRouteFromPath([id, sub]: readonly string[]): FacilitiesMemberRoute | null {
  switch (id) {
    case 'report-problem': return { id };
    case 'my-reports': return { id };
    case 'my-report': {
      const reportId = idSegment(sub);
      return reportId ? { id, reportId } : null;
    }
    default: return null;
  }
}

export function facilitiesRouteToPath(r: FacilitiesMemberRoute): string[] {
  return r.id === 'my-report' ? ['my-report', String(r.reportId)] : [r.id];
}

/**
 * Admin area screens (module routes from ModuleCatalog): admin.facilities → 'facilities',
 * admin.facility-reports → 'facility-reports', admin.incidents → 'incidents'. The others belong to one of them.
 */
export const FACILITIES_ADMIN_OWNERS = {
  'facility-asset': 'facilities',
  'facility-report': 'facility-reports',
  'incident': 'incidents',
  'incident-new': 'incidents',
} as const;
