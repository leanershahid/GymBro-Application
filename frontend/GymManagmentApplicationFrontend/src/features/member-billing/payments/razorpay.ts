import { T } from '../../../theme';
import { OnlineOrder, CheckoutSuccess } from '../types/memberBilling.types';

export const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/** The JSON-safe part of Checkout's options (handlers are attached where Checkout runs). */
export function checkoutOptions(order: OnlineOrder) {
  const prefill: Record<string, string> = {};
  if (order.memberName) prefill.name = order.memberName;
  if (order.memberEmail) prefill.email = order.memberEmail;
  if (order.memberPhone) prefill.contact = order.memberPhone;
  return {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amountMinor,
    currency: order.currency,
    name: order.gymName || 'Membership payment',
    description: `Invoice ${order.invoiceNo}`,
    prefill,
    notes: { invoiceNo: order.invoiceNo },
    theme: { color: T.brand },
  };
}

export interface CheckoutCallbacks {
  onSuccess: (r: CheckoutSuccess) => void;
  onDismiss: () => void;
  onFailed: (reason: string) => void;
}

// ── Web ──────────────────────────────────────────────────────────────────────

let scriptPromise: Promise<void> | null = null;

/** Adds checkout.js once; later calls reuse the same promise. */
function loadScript(): Promise<void> {
  const w = globalThis as any;
  if (w.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const doc = w.document;
    if (!doc) { reject(new Error('Online payment needs a browser.')); return; }
    const el = doc.createElement('script');
    el.src = RAZORPAY_SCRIPT;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      el.remove();
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    doc.body.appendChild(el);
  });
  return scriptPromise;
}

/** Opens Razorpay Checkout in the browser. Resolves once the window is open. */
export async function openWebCheckout(order: OnlineOrder, cb: CheckoutCallbacks): Promise<void> {
  await loadScript();
  const Razorpay = (globalThis as any).Razorpay;
  if (!Razorpay) throw new Error('Payment window is unavailable.');
  let settled = false;
  const rzp = new Razorpay({
    ...checkoutOptions(order),
    handler: (resp: CheckoutSuccess) => { settled = true; cb.onSuccess(resp); },
    modal: { ondismiss: () => { if (!settled) cb.onDismiss(); } },
  });
  // Checkout stays open after a failed attempt so the member can retry; we only report it.
  rzp.on('payment.failed', (resp: any) => cb.onFailed(resp?.error?.description || 'Payment failed.'));
  rzp.open();
}

// ── Native (WebView) ─────────────────────────────────────────────────────────

/** Self-contained page that runs the same Checkout and posts the result to React Native. */
export function checkoutHtml(order: OnlineOrder): string {
  const opts = JSON.stringify(checkoutOptions(order)).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:${T.bg};color:${T.textSub};font-family:sans-serif}
#s{display:flex;height:100%;align-items:center;justify-content:center;font-size:14px}</style></head>
<body><div id="s">Opening secure payment…</div>
<script>
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
var done=false;
function start(){
  try{
    var o=${opts};
    o.handler=function(r){done=true;post({type:'success',payload:r});};
    o.modal={ondismiss:function(){if(!done)post({type:'dismiss'});}};
    var rzp=new Razorpay(o);
    rzp.on('payment.failed',function(r){post({type:'failed',reason:(r&&r.error&&r.error.description)||'Payment failed.'});});
    rzp.open();
  }catch(e){post({type:'error',reason:String(e&&e.message||e)});}
}
</script>
<script src="${RAZORPAY_SCRIPT}" onload="start()" onerror="post({type:'error',reason:'Could not load the payment window.'})"></script>
</body></html>`;
}
