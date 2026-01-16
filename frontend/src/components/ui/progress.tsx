import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const Progress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number, indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative h-4 w-full overflow-hidden rounded-full bg-slate-100",
            className
        )}
        {...props}
    >
        <div
            className={cn("h-full w-full flex-1 bg-blue-600 transition-all", indicatorClassName)}
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </div>
))
Progress.displayName = "Progress"

export { Progress }
