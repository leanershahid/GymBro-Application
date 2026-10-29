// Web runs Checkout directly in the page (razorpay.ts → openWebCheckout); react-native-webview
// has no web build, so this platform file keeps it out of the web bundle.
export default function RazorpayNativeModal(_props: unknown) {
  return null;
}
