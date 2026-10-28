'use client';

import { useState, useEffect, useCallback } from 'react';
import { Customer, CustomerStats, CustomerApiResponse } from '@/types/customer';

// Use a relative API base so the frontend calls the same origin the app is served from.
// This avoids port mismatches during `next dev` where Next may switch ports.
const API_BASE = '/api/v1';

type RawCustomer = {
  _id?: string;
  id?: string;
  customerId?: string;
  customerName?: string;
  name?: string;
  emailAddress?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  customerAddress?: string;
  address?: string;
  createdAt?: string;
  isActive?: boolean;
  source?: 'user' | 'customer';
  recordId?: string;
};

const DEMO_CUSTOMERS: RawCustomer[] = [];

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

const normalizeCustomerId = (value: string | undefined | null) =>
  String(value ?? '').replace(/^#+/, '');

const mapCustomer = (customer: RawCustomer): Customer => {
  const name = customer.customerName || customer.name || 'Website Customer';
  const id = normalizeCustomerId(customer.customerId || customer.id || customer._id || '');

  return {
    ...customer,
    id,
    name,
    initials: getInitials(name),
    email: customer.emailAddress || customer.email || '',
    phone: customer.phoneNumber || customer.phone || 'Not provided',
    address: customer.customerAddress || customer.address || 'Not provided',
    isActive: customer.isActive === true,
    source: customer.source || 'customer',
    recordId: customer.recordId || customer._id || id,
  };
};

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalActiveCustomers: 0,
    satisfactionRate: 0,
    newToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  // The customer directory design shows four complete rows per page so the
  // table footer and pagination remain visible inside the dashboard viewport.
  const [limit] = useState(8);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchCustomers = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/customers?page=${currentPage}&limit=${limit}`, {
        signal: AbortSignal.timeout(1500)
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json: CustomerApiResponse = await res.json();

      const isDemo = !(json.data && json.data.length);
      const enriched = (isDemo ? DEMO_CUSTOMERS : json.data).map(mapCustomer);
      let activeTotal =
        typeof json.activeTotal === 'number'
          ? json.activeTotal
          : enriched.filter((customer) => customer.isActive).length;

      if (typeof json.activeTotal !== 'number') {
        const allRes = await fetch(`${API_BASE}/customers?page=1&limit=10000`, {
          signal: AbortSignal.timeout(1500),
        });

        if (allRes.ok) {
          const allJson: CustomerApiResponse = await allRes.json();
          activeTotal = (allJson.data || [])
            .map(mapCustomer)
            .filter((customer) => customer.isActive).length;
        }
      }

      const today = new Date().toDateString();
      const newToday = enriched.filter((customer) => {
        if (!customer.createdAt) return false;
        return new Date(customer.createdAt).toDateString() === today;
      }).length;

      setCustomers(enriched);
      setTotal(isDemo ? enriched.length : json.total);
      setTotalPages(isDemo ? 1 : json.totalPages);
      setStats({
        totalActiveCustomers: activeTotal,
        satisfactionRate: json.total > 0 ? 100 : 0,
        newToday,
      });
    } catch {
      const demo = DEMO_CUSTOMERS.map(mapCustomer);
      setCustomers(demo);
      setTotal(demo.length);
      setTotalPages(1);
      setStats({
        totalActiveCustomers: demo.length,
        satisfactionRate: 0,
        newToday: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchCustomers(page);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [page, fetchCustomers]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  return {
    customers,
    stats,
    loading,
    error,
    page,
    total,
    totalPages,
    limit,
    goToPage,
    refresh: () => fetchCustomers(page),
  };
};
 
