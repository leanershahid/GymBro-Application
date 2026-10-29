import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import {
  MySubscription, MyInvoice, MyPayment, OnlinePaymentsStatus, OnlineOrder, VerifyPaymentPayload,
} from '../types/memberBilling.types';

const BASE = '/me/billing';

/** Returns `data`, or throws the envelope's message so React Query surfaces it as an error. */
function unwrap<T>(res: ApiResponse<T>, fallback: T | null = null): T {
  if (!res.success) throw new Error(res.message || 'Request failed.');
  if (res.data == null) {
    if (fallback !== null) return fallback;
    throw new Error(res.message || 'Empty response.');
  }
  return res.data;
}

export const fetchMyMemberships = async (): Promise<MySubscription[]> => {
  const { data } = await axiosInstance.get<ApiResponse<MySubscription[]>>(`${BASE}/memberships`);
  return unwrap(data, []);
};

export const fetchMyInvoices = async (): Promise<MyInvoice[]> => {
  const { data } = await axiosInstance.get<ApiResponse<MyInvoice[]>>(`${BASE}/invoices`);
  return unwrap(data, []);
};

export const fetchMyPayments = async (): Promise<MyPayment[]> => {
  const { data } = await axiosInstance.get<ApiResponse<MyPayment[]>>(`${BASE}/payments`);
  return unwrap(data, []);
};

export const fetchOnlinePayments = async (): Promise<OnlinePaymentsStatus> => {
  const { data } = await axiosInstance.get<ApiResponse<OnlinePaymentsStatus>>(`${BASE}/online-payments`);
  return unwrap(data, { enabled: false });
};

/** The invoice PDF as a Blob (web download). */
export const fetchInvoicePdf = async (invoiceId: number): Promise<Blob> => {
  const { data } = await axiosInstance.get<Blob>(`${BASE}/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  return data;
};

/** Creates the Razorpay order for an invoice's outstanding balance. */
export const startInvoicePayment = async (invoiceId: number): Promise<OnlineOrder> => {
  const { data } = await axiosInstance.post<ApiResponse<OnlineOrder>>(`${BASE}/invoices/${invoiceId}/pay`);
  return unwrap(data);
};

export const verifyInvoicePayment = async (payload: VerifyPaymentPayload): Promise<MyPayment> => {
  const { data } = await axiosInstance.post<ApiResponse<MyPayment>>(`${BASE}/payments/verify`, payload);
  return unwrap(data);
};
