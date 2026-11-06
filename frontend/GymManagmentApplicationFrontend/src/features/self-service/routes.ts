/**
 * Screens of member self-service (plan browser, join & pay, my membership, pause / cancel /
 * change-plan requests) for the area routers to wire.
 *
 * Member area (memberRoutes.ts / MemberApp.tsx), all under the `billing` module:
 *   { id: 'plans-browse' }                         /member/plans-browse
 *   { id: 'join'; planId?; coupon? }               /member/join[/{planId}]   (coupon stays in memory, not the URL)
 *   { id: 'my-membership' }                        /member/my-membership
 *   { id: 'membership-request'; requestId }        /member/membership-request/{id}
 *   Home: <ChooseMembershipCard onPress={() => go({ id: 'plans-browse' })} />   (hides once a membership is live)
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx), module `admin.membership-requests` (route key 'membership-requests'):
 *   { screen: 'membership-requests', id?: memberId }   /admin/membership-requests[/{memberId}]
 *   → <MembershipRequestsPage memberId={id || undefined} onBack={back} onOpenMember={id => open('member-detail', id)} />
 */
export * from './routePaths';

export { default as PlansBrowseScreen } from './screens/PlansBrowseScreen';
export { default as JoinFlowScreen } from './screens/JoinFlowScreen';
export { default as MyMembershipScreen } from './screens/MyMembershipScreen';
export { default as MembershipRequestScreen } from './screens/MembershipRequestScreen';
export { default as ChooseMembershipCard } from './components/ChooseMembershipCard';
export { default as MembershipRequestsPage } from './pages/MembershipRequestsPage';
export { default as MemberRequestsLink } from './components/MemberRequestsLink';
export { usePendingRequestCount, useMembershipRequestBadge } from './api/selfServiceQueries';
