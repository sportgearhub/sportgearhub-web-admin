import * as SelectPrimitive from '@radix-ui/react-select'
import type { ComponentProps } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const EMPTY_VALUE = '__empty_select_value__'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SelectProps = {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  ariaLabel?: string
  className?: string
  contentClassName?: string
}

function toRadixValue(value: string) {
  return value === '' ? EMPTY_VALUE : value
}

function fromRadixValue(value: string) {
  return value === EMPTY_VALUE ? '' : value
}

export function Select({
  value,
  options,
  onValueChange,
  placeholder,
  disabled,
  autoFocus,
  ariaLabel,
  className,
  contentClassName,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={toRadixValue(value)} onValueChange={(nextValue) => onValueChange(fromRadixValue(nextValue))} disabled={disabled}>
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={cn(
          'border-input bg-card text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-sm border px-2 py-1 text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={4}
          className={cn(
            'bg-popover text-popover-foreground z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-sm border shadow-lg',
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectItem key={`${option.value}-${option.label}`} value={toRadixValue(option.value)} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'focus:bg-accent focus:text-accent-foreground relative flex h-8 cursor-default select-none items-center rounded-sm py-1 pr-2 pl-7 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}
