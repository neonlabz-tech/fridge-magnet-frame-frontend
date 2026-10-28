'use client';

import CustomerTable from '@/components/dashboard/Customer/CustomerTable';

export default function CustomersPage() {
  return (
    <div className="compact-ui relative mx-auto flex min-h-full w-full max-w-7xl flex-col px-3 pb-4 pt-2 sm:px-6 sm:pt-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:px-8 lg:pb-4 lg:pt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#071C40] sm:text-[28px]">
          Customers Management
        </h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          View, add and manage your customer directory.
        </p>
      </div>

      <CustomerTable />
    </div>
  );
}
