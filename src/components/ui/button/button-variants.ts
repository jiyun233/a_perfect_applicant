import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex min-w-0 items-center justify-center gap-2 whitespace-normal rounded-lg py-2 text-center text-sm font-medium leading-snug transition-[background-color,color,border-color,opacity] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border border-border bg-secondary text-secondary-foreground hover:bg-accent',
        outline: 'border border-input bg-card text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 px-4 sm:min-h-10',
        sm: 'min-h-11 rounded-md px-3 text-sm sm:min-h-9 sm:text-xs',
        lg: 'min-h-12 rounded-lg px-6 text-base',
        icon: 'size-11 shrink-0 rounded-lg sm:size-10',
        'icon-sm': 'size-11 shrink-0 rounded-md sm:size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
