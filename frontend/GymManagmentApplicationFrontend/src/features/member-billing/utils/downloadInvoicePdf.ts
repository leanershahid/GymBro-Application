import { Platform } from 'react-native';
import { fetchInvoicePdf } from '../api/memberBillingApi';

/** PDF download is web-only for now (no expo-sharing / expo-file-system in the app). */
export const canDownloadPdf = Platform.OS === 'web';

/** Fetches the invoice PDF with the signed-in session and saves it via an object URL. */
export async function downloadInvoicePdf(invoiceId: number, invoiceNo: string): Promise<void> {
  const blob = await fetchInvoicePdf(invoiceId);
  const w = globalThis as any;
  const url: string = w.URL.createObjectURL(blob);
  const a = w.document.createElement('a');
  a.href = url;
  a.download = `invoice-${invoiceNo || invoiceId}.pdf`;
  a.rel = 'noopener';
  w.document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => w.URL.revokeObjectURL(url), 60_000);
}
