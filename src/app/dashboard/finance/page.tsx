'use client';

import FinanceView from '@/components/dashboard/finance/FinanceView';

export default function FinancePage() {
  return (
    <div className="compact-ui relative mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4">
      <FinanceView />
    </div>
  );
}
