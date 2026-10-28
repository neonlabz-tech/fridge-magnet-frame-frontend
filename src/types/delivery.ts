export type DeliveryStatus = 'pending' | 'in-transit' | 'delivered' | 'returned';
export type DeliveryMethod = 'Standard' | 'Courier';

export interface Delivery {
  id: string; // #MGD-260913
  orderId: string; // #MGO-250521-08
  orderTotal: number;
  method: DeliveryMethod;
  tracking: string;
  driver: string;
  place: string; // short place shown in the table
  recipient: string;
  phone: string;
  address: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  status: DeliveryStatus;
  vehicleType: string;
  licenseNo: string;
  plateNo: string;
  emergencyContact: string;
  zones: string[];
}

export interface DispatchOrder {
  orderId: string;
  badge: 'Ready to Dispatch' | 'Pending Pack' | 'Standard';
  total: number;
  customer: string;
  phone: string;
  place: string;
  address: string;
}
