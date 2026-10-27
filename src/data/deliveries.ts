import type { Delivery, DispatchOrder } from '@/types/delivery';

/** Dispatch options (configuration, not records). */
export const DRIVERS = ['S. Sasikaran', 'K. Srinivasan', 'M. Dilkesh', 'E. Niroshan'];
export const TIME_SLOTS = [
  '09:00 AM - 12:00 PM',
  '12:00 PM - 02:00 PM',
  '02:00 PM - 05:00 PM',
  '05:00 PM - 08:00 PM',
];

export const DISPATCH_ORDERS: DispatchOrder[] = [];
export const INITIAL_DELIVERIES: Delivery[] = [];
