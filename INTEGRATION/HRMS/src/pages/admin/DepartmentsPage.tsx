import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  type Department,
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '@/hooks/useDepartments'
import { useAuth } from '@/contexts/AuthContext'
import { canApproveWork } from '@/lib/roles'
import { useSubmitChangeRequest } from '@/hooks/useChangeRequests'
import { Badge } from '@/components/ui/badge'

const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  description: z.string().max(500).optional(),
})
type DepartmentFormValues = z.infer<typeof departmentSchema>

function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  department?: Department | null
}) {
  const isEdit = !!department
  const { profile } = useAuth()
  // HR Staff prepares; HR Manager approves. Manager/Admin write directly
  // because they are the approving authority.
  const canWriteDirect = canApproveWork(profile?.role)
  const createDept = useCreateDepartment()
  const updateDept = useUpdateDepartment()
  const submitRequest = useSubmitChangeRequest()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({ resolver: zodResolver(departmentSchema) })

  React.useEffect(() => {
    if (open) reset({ name: department?.name ?? '', description: department?.description ?? '' })
  }, [open, department, reset])

  const onSubmit = async (values: DepartmentFormValues) => {
    if (canWriteDirect) {
      if (isEdit) {
        await updateDept.mutateAsync({ id: department.id, values })
      } else {
        await createDept.mutateAsync(values)
      }
    } else {
      await submitRequest.mutateAsync({
        targetTable: 'departments',
        operation: isEdit ? 'update' : 'create',
        targetId: department?.id,
        payload: { name: values.name, description: values.description || null },
        summary: `${isEdit ? 'Update' : 'Create'} department: ${values.name}`,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit department' : 'New department'}</DialogTitle>
          <DialogDescription>
            {canWriteDirect
              ? isEdit
                ? 'Update this department\u2019s details.'
                : 'Departments group positions and employees for reporting and access.'
              : 'Your change goes to an HR Manager for approval before it takes effect.'}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" invalid={!!errors.name} {...register('name')} placeholder="e.g. Human Resources" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} placeholder="Optional" rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {canWriteDirect ? (isEdit ? 'Save changes' : 'Create department') : 'Submit for approval'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function DepartmentsPage() {
  const { profile } = useAuth()
  const canWriteDirect = canApproveWork(profile?.role)
  const { data, isLoading } = useDepartments()
  const deleteDept = useDeleteDepartment()
  const submitRequest = useSubmitChangeRequest()
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Department | null>(null)
  const [deleting, setDeleting] = React.useState<Department | null>(null)

  const columns: ColumnDef<Department>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description || '\u2014'}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original)
                setFormOpen(true)
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem destructive onClick={() => setDeleting(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Departments</h2>
          <p className="text-sm text-muted-foreground">Organizational units used across recruitment and employee records.</p>
        </div>
        {!canWriteDirect && <Badge variant="warning">Changes need HR Manager approval</Badge>}
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search departments..."
        searchColumn="name"
        emptyTitle="No departments yet"
        emptyDescription="Create your first department to start assigning positions and employees."
        toolbarAction={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            New department
          </Button>
        }
      />

      <DepartmentFormDialog open={formOpen} onOpenChange={setFormOpen} department={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {canWriteDirect
                ? "This can't be undone. Departments with existing positions can't be deleted until those are reassigned."
                : 'Deletions are reviewed by an HR Manager. Nothing is removed until they approve it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) {
                  if (canWriteDirect) {
                    await deleteDept.mutateAsync(deleting.id)
                  } else {
                    await submitRequest.mutateAsync({
                      targetTable: 'departments',
                      operation: 'delete',
                      targetId: deleting.id,
                      summary: `Delete department: ${deleting.name}`,
                    })
                  }
                }
                setDeleting(null)
              }}
            >
              {canWriteDirect ? 'Delete' : 'Submit for approval'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
