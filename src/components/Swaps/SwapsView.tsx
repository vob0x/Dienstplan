/**
 * V2 Standalone Swaps View
 * Combines SwapList + ApprovalList in a dedicated navigation tab
 */
import { useSwapStore } from '@/stores/swapStore'
import { useI18n } from '@/i18n'
import { ArrowRightLeft } from 'lucide-react'
import SwapList from '@/components/Team/SwapList'
import ApprovalList from '@/components/Team/ApprovalList'

export default function SwapsView() {
  const { t } = useI18n()
  const swaps = useSwapStore((s) => s.swaps)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ApprovalList />
      <SwapList />
      {swaps.length === 0 && (
        <div className="text-center py-8">
          <ArrowRightLeft size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swaps.emptyState')}</p>
        </div>
      )}
    </div>
  )
}
