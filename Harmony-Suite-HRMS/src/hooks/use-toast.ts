import * as React from 'react'

type ToastVariant = 'default' | 'destructive' | 'success'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
}

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 4000

type Action =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; toastId: string }

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: 'REMOVE_TOAST', toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

const listeners: Array<(state: Toast[]) => void> = []
let memoryState: Toast[] = []

function dispatch(action: Action) {
  switch (action.type) {
    case 'ADD_TOAST':
      memoryState = [action.toast, ...memoryState].slice(0, TOAST_LIMIT)
      break
    case 'REMOVE_TOAST':
      memoryState = memoryState.filter((t) => t.id !== action.toastId)
      break
  }
  listeners.forEach((listener) => listener(memoryState))
}

export function toast({ title, description, variant = 'default' }: Omit<Toast, 'id'>) {
  const id = genId()
  dispatch({ type: 'ADD_TOAST', toast: { id, title, description, variant } })
  addToRemoveQueue(id)
  return { id }
}

export function useToast() {
  const [state, setState] = React.useState<Toast[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return { toasts: state, toast }
}
