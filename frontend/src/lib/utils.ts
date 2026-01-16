/**
 * 檔案名稱: lib/utils.ts
 * 功能描述: 通用工具函式 (General Utilities)
 * 
 * 包含專案中共用的輔助函式。
 * 
 * 主要函式:
 * - cn (...inputs): 結合 `clsx` 與 `tailwind-merge` 的強大工具。
 *   用於動態合併 Tailwind CSS class，並自動解決樣式衝突 (如 `p-4` vs `p-2`)。
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
