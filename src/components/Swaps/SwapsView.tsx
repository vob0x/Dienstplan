/**
 * V2 Standalone Swaps View
 * Combines SwapList + ApprovalList in a dedicated navigation tab
 */
import SwapList from '@/components/Team/SwapList'
import ApprovalList from '@/components/Team/ApprovalList'

export default function SwapsView() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ApprovalList />
      <SwapList />
    </div>
  )
}
