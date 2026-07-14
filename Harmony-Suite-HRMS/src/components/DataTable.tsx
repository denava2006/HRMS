import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface DataTableProps<T> {
  data: T[]
  columns: {
    key: string
    header: string
    render: (item: T) => React.ReactNode
  }[]
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  emptyMessage?: string
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {onSearchChange && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      )}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-light-gray">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left font-medium text-navy">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-light-gray/50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
