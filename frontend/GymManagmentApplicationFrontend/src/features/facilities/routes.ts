/**
 * Facilities (roadmap feature 7): equipment register, problem reports, incident log.
 *
 * Member area (memberRoutes.ts / MemberApp.tsx), always open:
 *   { id: 'report-problem' }               /member/report-problem
 *   { id: 'my-reports' }                   /member/my-reports
 *   { id: 'my-report'; reportId }          /member/my-report/{id}
 * Trainer area: { id: 'report-problem' }  /trainer/report-problem (same screen).
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx):
 *   facilities (admin.facilities) · facility-asset/{id}
 *   facility-reports (admin.facility-reports) · facility-report/{id}
 *   incidents (admin.incidents, restricted) · incident/{id} · incident-new[/{id} = edit an open one]
 */
export * from './routePaths';

export { default as ReportProblemScreen } from './screens/ReportProblemScreen';
export { default as MyReportsScreen } from './screens/MyReportsScreen';
export { default as MyReportScreen } from './screens/MyReportScreen';
export { default as FacilitiesPage } from './pages/FacilitiesPage';
export { default as FacilityAssetPage } from './pages/FacilityAssetPage';
export { default as FacilityReportsPage } from './pages/FacilityReportsPage';
export { default as FacilityReportPage } from './pages/FacilityReportPage';
export { default as IncidentsPage } from './pages/IncidentsPage';
export { default as IncidentPage } from './pages/IncidentPage';
export { default as IncidentFormPage } from './pages/IncidentFormPage';
/** Member branch info: "Out of service: Treadmill 3 (back ~Fri)" + a report link. */
export { default as OutOfServiceList } from './components/OutOfServiceList';
export { useFacilityReportCounts } from './api/facilitiesQueries';
