import { canDo } from '@/lib/roles';
import { SquarePlus } from 'lucide-react';

interface ProductHeaderProps {
  onAddClick: () => void;
}

export default function ProductHeader({ onAddClick }: ProductHeaderProps) {
  return (
    <section className="flex-shrink-0 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <h1
          className="font-bold text-[26px] sm:text-[28px] leading-tight"
          style={{
            fontFamily: 'var(--font-manrope, Manrope, sans-serif)',
            color: '#002B73',
            letterSpacing: '-1.2px',
          }}
        >
          Product Management
        </h1>
      </div>

      {/* Add Product button */}
      <div className="flex justify-end pb-3 pt-2">
        {canDo('/dashboard/products','create') && (
          <button
          type="button"
          onClick={onAddClick}
          className="whitespace-nowrap flex-shrink-0 flex items-center gap-2 rounded-lg bg-[#BC0000] px-5 py-2.5 text-sm sm:text-[15px] font-bold text-white shadow-sm hover:opacity-90 transition-colors"
        >
          + Add Product
        </button>
        )}
      </div>
    </section>
  );
}