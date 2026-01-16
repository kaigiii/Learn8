/**
 * 檔案名稱: frontend/src/components/ui/input.tsx
 * 功能描述: 通用輸入框組件 (Input UI)
 * 
 * 封裝了 HTML原生的 <input> 元素，統一應用程式的輸入框樣式。
 * 
 * 特色:
 *     - 預設樣式: 圓角、邊框、Focus Ring (藍色光暈)。
 *     - 狀態支援: Disabled, Placeholder, File Input。
 *     - 整合: 透過 `React.forwardRef` 支援 React Hook Form。
 */
import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
