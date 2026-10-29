import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useStartInvoicePayment, useVerifyInvoicePayment } from '../api/memberBillingQueries';
import { CheckoutSuccess, MyInvoice, OnlineOrder } from '../types/memberBilling.types';
import { openWebCheckout } from '../payments/razorpay';

/**
 * Pay an invoice online: create the Razorpay order → open Checkout (in-page on web, WebView
 * modal on native) → verify the signed result on the server → toast + refetch.
 * Render `<RazorpayNativeModal {...nativeModalProps} />` once on the screen for native.
 */
export function useInvoiceCheckout(userId: number) {
  const toast = useToast();
  const start = useStartInvoicePayment();
  const verify = useVerifyInvoicePayment(userId);

  /** Invoice currently going through checkout (drives button spinners). */
  const [payingId, setPayingId] = useState<number | null>(null);
  /** Native only: the order the WebView modal is showing. */
  const [nativeOrder, setNativeOrder] = useState<OnlineOrder | null>(null);

  const finish = useCallback(() => { setPayingId(null); setNativeOrder(null); }, []);

  const onSuccess = useCallback((order: OnlineOrder, r: CheckoutSuccess) => {
    setNativeOrder(null);
    verify.mutate(
      {
        invoiceId: order.invoiceId,
        orderId: r.razorpay_order_id || order.orderId,
        paymentId: r.razorpay_payment_id,
        signature: r.razorpay_signature,
      },
      {
        onSuccess: () => toast.show({ type: 'success', message: `Payment received for ${order.invoiceNo}. Thank you!` }),
        onError: e => toast.show({
          type: 'error',
          message: `We couldn't confirm your payment yet: ${apiErrorText(e)} If money was debited, it will reflect shortly.`,
          durationMs: 6000,
        }),
        onSettled: () => setPayingId(null),
      },
    );
  }, [verify, toast]);

  const onFailed = useCallback((reason: string) => {
    toast.show({ type: 'error', message: `Payment failed: ${reason}` });
  }, [toast]);

  const pay = useCallback(async (invoice: MyInvoice) => {
    if (payingId !== null) return;
    setPayingId(invoice.id);
    let order: OnlineOrder;
    try {
      order = await start.mutateAsync(invoice.id);
    } catch (e) {
      toast.show({ type: 'error', message: apiErrorText(e) });
      setPayingId(null);
      return;
    }

    if (Platform.OS === 'web') {
      try {
        await openWebCheckout(order, {
          onSuccess: r => onSuccess(order, r),
          onDismiss: () => setPayingId(null),
          onFailed,
        });
      } catch (e) {
        toast.show({ type: 'error', message: apiErrorText(e) });
        setPayingId(null);
      }
    } else {
      setNativeOrder(order);
    }
  }, [payingId, start, toast, onSuccess, onFailed]);

  const nativeModalProps = {
    order: nativeOrder,
    onSuccess: (r: CheckoutSuccess) => { if (nativeOrder) onSuccess(nativeOrder, r); },
    onDismiss: finish,
    onFailed,
    onError: (reason: string) => { toast.show({ type: 'error', message: reason }); finish(); },
  };

  return { pay, payingId, verifying: verify.isPending, nativeModalProps };
}
