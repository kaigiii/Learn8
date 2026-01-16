/**
 * 檔案名稱: components/ui/button.tsx
 * 功能描述: 通用按鈕組件 (Button UI)
 * 
 * 基於 Radix UI / Shadcn UI 設計的高可客製化按鈕。
 * 
 * Props:
 * - variant: 'default' | 'outline' | 'ghost' (外觀風格)。
 * - size: 'default' | 'sm' | 'lg' | 'icon' (尺寸)。
 * - asChild: 是否將樣式傳遞給子元素 (Slot Pattern)。
 */
import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    {
                        'bg-blue-600 text-white hover:bg-blue-700': variant === 'default',
                        'border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900': variant === 'outline',
                        'hover:bg-slate-100 hover:text-slate-900': variant === 'ghost',
                        'h-10 px-4 py-2': size === 'default',
                        'h-9 rounded-md px-3': size === 'sm',
                        'h-11 rounded-md px-8': size === 'lg',
                        'h-10 w-10': size === 'icon',
                    },
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
