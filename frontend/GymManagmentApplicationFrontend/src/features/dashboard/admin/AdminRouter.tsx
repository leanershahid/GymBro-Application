import React from 'react';
import ViewMembersPage   from '../../members/pages/ViewMembersPage';
import AddMemberPage     from '../../members/pages/AddMemberPage';
import MemberDetailPage  from '../../members/pages/MemberDetailPage';
import EditMemberPage    from '../../members/pages/EditMemberPage';
import ViewLeadsPage     from '../../leads/pages/ViewLeadsPage';
import AddLeadPage       from '../../leads/pages/AddLeadPage';
import ViewExercisesPage from '../../exercises/pages/ViewExercisesPage';
import AddExercisePage   from '../../exercises/pages/AddExercisePage';
import ViewWorkoutsPage  from '../../workouts/pages/ViewWorkoutsPage';
import AddWorkoutPage    from '../../workouts/pages/AddWorkoutPage';
import ViewPlansPage     from '../../workouts/pages/ViewPlansPage';
import AddPlanPage       from '../../workouts/pages/AddPlanPage';
import ViewBranchesPage  from '../../branches/pages/ViewBranchesPage';
import AddBranchPage     from '../../branches/pages/AddBranchPage';
import EditBranchPage    from '../../branches/pages/EditBranchPage';
import ViewTenantsPage   from '../../tenants/pages/ViewTenantsPage';
import AddTenantPage     from '../../tenants/pages/AddTenantPage';
import EditTenantPage    from '../../tenants/pages/EditTenantPage';
import ViewTrainersPage  from '../../trainers/pages/ViewTrainersPage';
import AddTrainerPage    from '../../trainers/pages/AddTrainerPage';
import LiveCoachingAdminPage from '../../trainers/pages/LiveCoachingAdminPage';
import ModuleAccessPage  from '../../module-access/pages/ModuleAccessPage';
import UserAccessListPage from '../../module-access/pages/UserAccessListPage';
import RolesPage         from '../../module-access/pages/RolesPage';
import ChallengesAdminPage from '../../challenges/pages/ChallengesAdminPage';
import StatsAdminPage    from '../../health/pages/StatsAdminPage';
import AiCoachSettingsPage from '../../ai-coach/pages/AiCoachSettingsPage';
import AttendanceSettingsPage from '../../attendance/pages/AttendanceSettingsPage';
import AttendanceLogPage from '../../attendance/pages/AttendanceLogPage';
import BillingHomePage   from '../../billing/pages/BillingHomePage';
import NewInvoicePage    from '../../billing/pages/NewInvoicePage';
import NewMembershipPage from '../../billing/pages/NewMembershipPage';
import ClassSchedulePage from '../../classes/pages/ClassSchedulePage';
import PtSessionsPage    from '../../classes/pages/PtSessionsPage';
import ShopAdminApp      from '../../shop/admin/ShopAdminApp';
import SocialApp         from '../../social/SocialApp';
import MoreActionsPage   from '../pages/MoreActionsPage';
import AdminProfileDetailsPage from '../pages/AdminProfileDetailsPage';
import NoModuleAccess    from './NoModuleAccess';
import { WaiverSettingsPage } from '../../safety/routes';
import { BookingRulesPage } from '../../booking-rules/routes';
import SecuritySettingsScreen from '../../auth/screens/SecuritySettingsScreen';
import { PrivacyRequestsPage } from '../../privacy/routes';
import { MembershipRequestsPage } from '../../self-service/routes';
import { SupportQueuePage, SupportRequestPage } from '../../support/routes';
import { MessagesReviewPage, MessagesReviewThreadPage } from '../../messaging/routes';
import {
  FacilitiesPage, FacilityAssetPage, FacilityReportPage, FacilityReportsPage, IncidentFormPage, IncidentPage, IncidentsPage,
} from '../../facilities/routes';
import { AnnouncementsAdminPage, AnnouncementEditorPage, ServiceStatusAdminPage, BranchHoursPage } from '../../operations/routes';
import type { OpenRequest } from '../../access/types/access.types';
import type { PathChange } from '../../../navigation/useAreaRoute';
import { AdminScreen, isAdminScreen } from './adminRoutes';
import { AdminAccess } from './useAdminAccess';
import { FrontDesk } from './useFrontDesk';

export interface AdminRouteContext {
  access: AdminAccess;
  desk: FrontDesk;
  /** Record the current detail/edit screen is about (member, branch, tenant, role). */
  selectedId: number;
  go: (s: AdminScreen) => void;
  open: (s: AdminScreen, id: number) => void;
  goHome: () => void;
  roleLabel: string;
  confirmLogout?: () => void;
  /** The shop's nested path: what the shell asks it to show, and where it reports moving. */
  shop: { open?: OpenRequest; onPathChange: PathChange };
}

/** The page when `allowed`, otherwise the "No access" screen whose Back goes to `back`. */
const gated = (allowed: boolean, page: React.ReactElement, back: () => void) =>
  allowed ? page : <NoModuleAccess onBack={back} />;

type Render = (c: AdminRouteContext) => React.ReactElement | null;

/**
 * Route → screen table for the admin area. Each page is still gated by its own permission here,
 * not only by hiding its tile (AdminDashboard additionally checks route ownership first).
 */
const ROUTES: Record<AdminScreen, Render> = {
  'home': () => null,

  // Members
  'members': ({ access: a, go, open, goHome }) => gated(a.members.canView,
    <ViewMembersPage onBack={goHome} onAddMember={a.members.canCreate ? () => go('add-member') : undefined} onOpenMember={(id) => open('member-detail', id)} />, goHome),
  'member-detail': ({ access: a, desk, selectedId, go, open }) => gated(a.members.canView,
    <MemberDetailPage memberId={selectedId} onBack={() => go('members')} canEdit={a.members.canEdit}
      onEdit={a.members.canEdit ? () => go('edit-member') : undefined}
      onNewMembership={a.billing.canCreate ? () => { desk.setSellName(undefined); go('new-membership'); } : undefined}
      onNewInvoice={a.billing.canCreate ? () => { desk.setInvoiceFor(selectedId); go('new-invoice'); } : undefined}
      onCheckIn={a.attendance.canCreate ? () => desk.checkInMember(selectedId) : undefined}
      onOpenMembershipRequests={a.membershipRequests.canView ? () => open('membership-requests', selectedId) : undefined}
      checkingIn={desk.checkIn.isPending} />, () => go('members')),
  'edit-member': ({ access: a, selectedId, go }) => gated(a.members.canEdit,
    <EditMemberPage memberId={selectedId} onBack={() => go('member-detail')} onSaved={() => go('member-detail')} />, () => go('member-detail')),
  'add-member': ({ access: a, desk, go, open }) => gated(a.members.canCreate,
    <AddMemberPage onBack={() => go('members')}
      onOpenMember={(id) => open('member-detail', id)}
      onSellMembership={a.billing.canCreate ? (id, name) => { desk.setSellName(name); open('new-membership', id); } : undefined} />, () => go('members')),

  // Trainers
  'trainers': ({ access: a, go, goHome }) => gated(a.trainers.canView,
    <ViewTrainersPage onBack={goHome} onAddTrainer={a.trainers.canCreate ? () => go('add-trainer') : undefined} />, goHome),
  'add-trainer': ({ access: a, go }) => gated(a.trainers.canCreate, <AddTrainerPage onBack={() => go('trainers')} />, () => go('trainers')),

  // Branches
  'branches': ({ access: a, go, open, goHome }) => gated(a.branches.canView,
    <ViewBranchesPage onBack={goHome} onAddBranch={a.branches.canCreate ? () => go('add-branch') : undefined}
      onEditBranch={a.branches.canEdit ? (id) => open('edit-branch', id) : undefined} />, goHome),
  'edit-branch': ({ access: a, selectedId, go }) => gated(a.branches.canEdit,
    <EditBranchPage branchId={selectedId} onBack={() => go('branches')} onSaved={() => go('branches')} />, () => go('branches')),
  'add-branch': ({ access: a, go }) => gated(a.branches.canCreate, <AddBranchPage onBack={() => go('branches')} />, () => go('branches')),

  // Tenants
  'tenants': ({ access: a, go, open, goHome }) => gated(a.tenants.canView,
    <ViewTenantsPage onBack={goHome} onAddTenant={a.tenants.canCreate ? () => go('add-tenant') : undefined}
      onEditTenant={a.tenants.canEdit ? (id) => open('edit-tenant', id) : undefined} />, goHome),
  'edit-tenant': ({ access: a, selectedId, go }) => gated(a.tenants.canEdit,
    <EditTenantPage tenantId={selectedId} onBack={() => go('tenants')} onSaved={() => go('tenants')} />, () => go('tenants')),
  'add-tenant': ({ access: a, go }) => gated(a.tenants.canCreate, <AddTenantPage onBack={() => go('tenants')} />, () => go('tenants')),

  // Leads
  'leads': ({ access: a, go, goHome }) => gated(a.leads.canView,
    <ViewLeadsPage onBack={goHome} onAddLead={a.leads.canCreate ? () => go('add-lead') : undefined} />, goHome),
  'add-lead': ({ access: a, go }) => gated(a.leads.canCreate, <AddLeadPage onBack={() => go('leads')} />, () => go('leads')),

  // Exercises / workouts / plans
  'exercises': ({ access: a, go, goHome }) => gated(a.exercises.canView,
    <ViewExercisesPage onBack={goHome} onAddExercise={a.exercises.canCreate ? () => go('add-exercise') : undefined} />, goHome),
  'add-exercise': ({ access: a, go }) => gated(a.exercises.canCreate, <AddExercisePage onBack={() => go('exercises')} />, () => go('exercises')),
  'workouts': ({ access: a, go, goHome }) => gated(a.workouts.canView,
    <ViewWorkoutsPage onBack={goHome} onAddWorkout={a.workouts.canCreate ? () => go('add-workout') : undefined} />, goHome),
  'add-workout': ({ access: a, go }) => gated(a.workouts.canCreate, <AddWorkoutPage onBack={() => go('workouts')} />, () => go('workouts')),
  'plans': ({ access: a, go, goHome }) => gated(a.plans.canView,
    <ViewPlansPage onBack={goHome} onAddPlan={a.plans.canCreate ? () => go('add-plan') : undefined} />, goHome),
  'add-plan': ({ access: a, go }) => gated(a.plans.canCreate, <AddPlanPage onBack={() => go('plans')} />, () => go('plans')),

  // Shop / social
  'shop': ({ goHome, shop }) => <ShopAdminApp onBack={goHome} open={shop.open} onPathChange={shop.onPathChange} />,
  'social': ({ goHome }) => <SocialApp onBack={goHome} />,

  // Classes / PT
  'classes': ({ access: a, go, goHome }) => gated(a.classes.canView, <ClassSchedulePage mode="admin" onBack={goHome}
    onOpenBookingRules={a.classes.canEdit ? () => go('booking-rules') : undefined} />, goHome),
  // Cancellation & no-show rules (feature 9): settings are editable, so classes edit rights.
  'booking-rules': ({ access: a, go }) => gated(a.classes.canEdit, <BookingRulesPage onBack={() => go('classes')} />, () => go('classes')),
  'pt-sessions': ({ access: a, goHome }) => gated(a.pt.canView, <PtSessionsPage mode="admin" onBack={goHome} />, goHome),

  // Billing
  'billing': ({ access: a, desk, go, open, goHome }) => gated(a.billing.canView,
    <BillingHomePage onBack={goHome} onOpenMember={a.members.canView ? (id) => open('member-detail', id) : undefined}
      onNewInvoice={a.billing.canCreate ? () => { desk.setInvoiceFor(null); go('new-invoice'); } : undefined} />, goHome),
  'new-invoice': ({ access: a, desk, go }) => gated(a.billing.canCreate,
    <NewInvoicePage key={desk.invoiceFor ?? 0} memberId={desk.invoiceFor ?? undefined} onBack={() => go(desk.invoiceFor ? 'member-detail' : 'billing')} />, () => go('billing')),
  'new-membership': ({ access: a, desk, selectedId, go }) => gated(a.billing.canCreate,
    <NewMembershipPage memberId={selectedId} memberName={desk.sellName} onBack={() => go('member-detail')} />, () => go('member-detail')),

  // Roles & access
  'roles': ({ access: a, open, goHome }) => gated(a.roles.canView,
    <RolesPage onBack={goHome} onOpenRoleAccess={(id) => open('module-access', id)} />, goHome),
  'module-access': ({ access: a, selectedId, go, goHome }) => gated(a.roles.canView,
    <ModuleAccessPage onBack={() => go('roles')} initialRoleId={selectedId || undefined} />, goHome),
  'user-access': ({ goHome }) => <UserAccessListPage onBack={goHome} />,

  // Member-app admin settings
  'challenges-admin': ({ goHome }) => <ChallengesAdminPage onBack={goHome} />,
  'stats-admin': ({ goHome }) => <StatsAdminPage onBack={goHome} />,
  'live-coaching-admin': ({ goHome }) => <LiveCoachingAdminPage onBack={goHome} />,
  'ai-coach-admin': ({ goHome }) => <AiCoachSettingsPage onBack={goHome} />,

  // Attendance
  'attendance': ({ access: a, desk, go, open, goHome }) => gated(a.attendance.canView,
    <AttendanceLogPage onBack={goHome}
      onCheckIn={a.attendance.canCreate ? () => desk.setPickFor('check-in') : undefined}
      onOpenSettings={a.attendance.canEdit ? () => go('attendance-settings') : undefined}
      onOpenMember={a.members.canView ? (id) => open('member-detail', id) : undefined} />, goHome),
  'attendance-log': ({ access: a, open, goHome }) =>
    <AttendanceLogPage onBack={goHome} onOpenMember={a.members.canView ? (id) => open('member-detail', id) : undefined} />,
  // ARCH-144: settings are editable, so they need attendance edit rights, not just route ownership.
  'attendance-settings': ({ access: a, go }) => gated(a.attendance.canEdit,
    <AttendanceSettingsPage onBack={() => go('attendance')} onOpenLog={() => go('attendance')} />, () => go('attendance')),

  // Safety: waiver versions + gating settings (module admin.waivers)
  'waivers': ({ goHome }) => <WaiverSettingsPage onBack={goHome} />,
  // Privacy: deletion requests, data exports, privacy settings (module admin.privacy)
  // Self-service: members' pause / cancel / plan-change requests + membership rules (module admin.membership-requests).
  // The id, when set, is a member (opened from member detail).
  'membership-requests': ({ access: a, open, selectedId, goHome }) =>
    <MembershipRequestsPage onBack={goHome} memberId={selectedId || undefined}
      onOpenMember={a.members.canView ? (id) => open('member-detail', id) : undefined} />,
  'privacy-requests': ({ access: a, open, goHome }) =>
    <PrivacyRequestsPage onBack={goHome} onOpenMember={a.members.canView ? (id) => open('member-detail', id) : undefined} />,
  // Help & feedback: members' support requests, FAQ, saved replies, class feedback (module admin.support).
  'support': ({ open, goHome }) => <SupportQueuePage onBack={goHome} onOpen={(id) => open('support-request', id)} />,
  'support-request': ({ access: a, open, go, selectedId }) => <SupportRequestPage requestId={selectedId} onBack={() => go('support')}
    onOpenMember={a.members.canView ? (id) => open('member-detail', id) : undefined} />,
  // Messaging: read-only safeguarding review of trainer ↔ member threads + messaging policy (module admin.messages).
  'messages-review': ({ open, goHome }) => <MessagesReviewPage onBack={goHome} onOpen={(id) => open('messages-review-thread', id)} />,
  'messages-review-thread': ({ selectedId, go }) => <MessagesReviewThreadPage conversationId={selectedId} onBack={() => go('messages-review')} />,

  // Facilities: equipment register (admin.facilities), problem-report queue (admin.facility-reports),
  // restricted incident log (admin.incidents). incident-new's optional id = edit that open incident.
  'facilities': ({ open, go, goHome }) => <FacilitiesPage onBack={goHome} onOpenAsset={(id) => open('facility-asset', id)} onOpenReports={() => go('facility-reports')} />,
  'facility-asset': ({ selectedId, open, go }) => <FacilityAssetPage assetId={selectedId} onBack={() => go('facilities')} onOpenReport={(id) => open('facility-report', id)} />,
  'facility-reports': ({ open, goHome }) => <FacilityReportsPage onBack={goHome} onOpen={(id) => open('facility-report', id)} />,
  'facility-report': ({ selectedId, open, go }) => <FacilityReportPage reportId={selectedId} onBack={() => go('facility-reports')} onOpenAsset={(id) => open('facility-asset', id)} />,
  'incidents': ({ open, goHome }) => <IncidentsPage onBack={goHome} onOpen={(id) => open('incident', id)} onNew={() => open('incident-new', 0)} />,
  'incident': ({ selectedId, open, go }) => <IncidentPage incidentId={selectedId} onBack={() => go('incidents')} onEdit={(id) => open('incident-new', id)} />,
  'incident-new': ({ selectedId, open, go }) => <IncidentFormPage key={selectedId} incidentId={selectedId || undefined}
    onBack={() => (selectedId ? open('incident', selectedId) : go('incidents'))} onSaved={(id) => open('incident', id)} />,

  // Operations: announcements, service notices, opening hours
  'announcements': ({ open, goHome }) => <AnnouncementsAdminPage onBack={goHome}
    onCompose={() => open('announcement-editor', 0)} onEdit={(id) => open('announcement-editor', id)} />,
  'announcement-editor': ({ selectedId, go }) => <AnnouncementEditorPage announcementId={selectedId || undefined}
    onBack={() => go('announcements')} onSaved={() => go('announcements')} />,
  'service-status': ({ goHome }) => <ServiceStatusAdminPage onBack={goHome} />,
  'branch-hours': ({ selectedId, goHome }) => <BranchHoursPage branchId={selectedId || undefined} onBack={goHome} />,

  // Always open
  'more-actions': ({ go, goHome, confirmLogout }) => <MoreActionsPage onBack={goHome} onNavigate={(k) => { if (isAdminScreen(k)) go(k); }} onLogout={confirmLogout} />,
  'profile-details': ({ goHome, roleLabel }) => <AdminProfileDetailsPage onBack={goHome} roleLabel={roleLabel} />,
  'security': ({ goHome }) => <SecuritySettingsScreen onBack={goHome} />,
};

/** The page for `screen`, or null for home (and unknown routes). */
export function renderAdminScreen(screen: AdminScreen, ctx: AdminRouteContext): React.ReactElement | null {
  const render = ROUTES[screen];
  return render ? render(ctx) : null;
}
