import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted mb-4">
      <Link to="/" className="hover:text-ocean transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4" />
          {item.href ? (
            <Link to={item.href} className="hover:text-ocean transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-navy font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
