import React, { useEffect, useState } from 'react';
import { Modal, Platform } from 'react-native';
import SafetyFlowScreen from '../screens/SafetyFlowScreen';
import { onSafetyFlowRequest, SafetyFlowRequest } from '../utils/safetyGate';

/** The safety flow as a full-screen modal (works on phones and web, no router needed). */
export function SafetyFlowModal({ request, onClose }: { request: SafetyFlowRequest | null; onClose: () => void }) {
  return (
    <Modal
      visible={!!request}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {request && <SafetyFlowScreen onClose={onClose} start={request.start} only={request.only} reason={request.reason} />}
    </Modal>
  );
}

/**
 * Mount once in the member area. Opens the flow whenever `openSafetyFlow()` /
 * `handleSafetyGateError(e)` is called — e.g. when booking or check-in returns SAFETY_REQUIRED.
 */
export default function SafetyGateHost() {
  const [request, setRequest] = useState<SafetyFlowRequest | null>(null);
  useEffect(() => onSafetyFlowRequest(setRequest), []);
  return <SafetyFlowModal request={request} onClose={() => setRequest(null)} />;
}
