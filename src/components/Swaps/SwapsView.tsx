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

  if (swaps.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <ArrowRightLeft size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
          {t('swaps.noSwaps')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swaps.emptyState')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ApprovalList />
      <SwapList />
    </div>
  )
}
