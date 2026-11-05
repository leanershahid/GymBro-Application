import React from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';
import Screen from '../../common/components/Screen';
import { OnlineOrder } from '../types/memberBilling.types';
import { checkoutHtml, CheckoutCallbacks } from './razorpay';

interface Props extends CheckoutCallbacks {
  /** The order to pay; the modal is open while this is set. */
  order: OnlineOrder | null;
  onError: (reason: string) => void;
}

// ── WebView hardening (ARCH-070) ────────────────────────────────────────────
// The checkout page is served as if from checkout.razorpay.com (baseUrl). Only that origin may
// talk to the app: a message posted from any other page (e.g. after a redirect) is ignored, so it
// can never fake a "success". Payments are verified server-side regardless.
const BASE_URL = 'https://checkout.razorpay.com/';
const isRazorpayUrl = (url: string | undefined) =>
  !!url && /^https:\/\/([a-z0-9-]+\.)*razorpay\.com(\/|$|\?|#)/i.test(url);

// Pages the WebView itself may load. Card 3-D Secure and net-banking pages live on bank
// domains, so any https page may load in-place; plain http, file:, javascript: etc. never do.
const ORIGIN_WHITELIST = ['https://*', 'about:blank', 'about:srcdoc', 'data:*', 'blob:*'];
// App-switch links used by UPI / wallet apps — handed to the OS instead of loaded.
const EXTERNAL_SCHEMES = /^(upi|intent|tez|phonepe|paytmmp|gpay|credpay|bhim):/i;

function onShouldStartLoad(req: ShouldStartLoadRequest): boolean {
  const url = req.url ?? '';
  if (/^https:\/\//i.test(url) || /^(about:(blank|srcdoc)|data:|blob:)/i.test(url)) return true;
  if (EXTERNAL_SCHEMES.test(url)) Linking.openURL(url).catch(() => {});
  return false;
}

/** Native: runs Razorpay Checkout inside a WebView and relays the result. (Web: see .web.tsx.) */
export default function RazorpayNativeModal({ order, onSuccess, onDismiss, onFailed, onError }: Props) {
  const onMessage = (e: WebViewMessageEvent) => {
    if (!isRazorpayUrl(e.nativeEvent.url)) return;
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'success') onSuccess(msg.payload);
    else if (msg.type === 'dismiss') onDismiss();
    else if (msg.type === 'failed') onFailed(msg.reason);
    else if (msg.type === 'error') onError(msg.reason);
  };

  return (
    <Modal visible={!!order} animationType="slide" onRequestClose={onDismiss}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52, borderBottomWidth: 1, borderBottomColor: T.line }}>
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel payment"
            style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
            <Feather name="x" size={22} color={T.text} />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }}>
            {order ? `Pay invoice ${order.invoiceNo}` : 'Payment'}
          </Text>
          <Feather name="lock" size={14} color={T.textSub} />
        </View>
        {order && (
          <WebView
            source={{ html: checkoutHtml(order), baseUrl: BASE_URL }}
            originWhitelist={ORIGIN_WHITELIST}
            onShouldStartLoadWithRequest={onShouldStartLoad}
            allowFileAccess={false}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onMessage={onMessage}
            onError={e => onError(e.nativeEvent.description || 'Could not load the payment window.')}
            startInLoadingState
            renderLoading={() => (
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
                <ActivityIndicator color={T.brand} size="large" />
              </View>
            )}
            style={{ flex: 1, backgroundColor: T.bg }}
          />
        )}
      </Screen>
    </Modal>
  );
}
