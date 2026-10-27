'use client';

import DeliveriesView from '@/components/dashboard/deliveries/DeliveriesView';

export default function DeliveriesPage() {
  return (
    <div className="compact-ui relative mx-auto flex min-h-full w-full max-w-7xl flex-col px-3 pb-4 pt-2 sm:px-6 sm:pt-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:px-8 lg:pb-4 lg:pt-4">
      <DeliveriesView />
    </div>
  );
}
