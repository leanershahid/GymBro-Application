import React from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
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

/** Native: runs Razorpay Checkout inside a WebView and relays the result. (Web: see .web.tsx.) */
export default function RazorpayNativeModal({ order, onSuccess, onDismiss, onFailed, onError }: Props) {
  const onMessage = (e: WebViewMessageEvent) => {
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
            source={{ html: checkoutHtml(order), baseUrl: 'https://checkout.razorpay.com/' }}
            originWhitelist={['*']}
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
