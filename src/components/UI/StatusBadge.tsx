interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const statusConfig: Record<string, { bgColor: string; textColor: string }> = {
  pending: {
    bgColor: 'var(--neon-amber)',
    textColor: '#0A0B0F',
  },
  accepted: {
    bgColor: 'var(--neon-cyan)',
    textColor: '#0A0B0F',
  },
  approved: {
    bgColor: 'var(--success)',
    textColor: '#0A0B0F',
  },
  completed: {
    bgColor: 'var(--success)',
    textColor: '#0A0B0F',
  },
  rejected: {
    bgColor: 'var(--danger)',
    textColor: '#FFF',
  },
  cancelled: {
    bgColor: 'var(--danger)',
    textColor: '#FFF',
  },
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`${sizeClasses} rounded-full font-mono`}
      style={{
        background: `${config.bgColor}20`,
        color: config.textColor,
      }}
    >
      {status}
    </span>
  )
}
