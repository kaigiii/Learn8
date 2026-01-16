/**
 * 檔案名稱: frontend/src/components/ui/card.tsx
 * 功能描述: 通用卡片組件 (Card UI)
 * 
 * 用於顯示區塊內容的容器組件，包含 Header, Title, Content, Footer 等子組件。
 * 
 * 組件列表:
 *     - Card: 主容器，預設帶有圓角、邊框與陰影。
 *     - CardHeader: 標題區域容器。
 *     - CardTitle: 卡片標題，預設字體較大且加粗。
 *     - CardDescription: 副標題或說明文字，顏色較淡。
 *     - CardContent: 主要內容區域。
 *     - CardFooter: 底部區域，常用於放置按鈕。
 * 
 * 使用範例:
 *     <Card>
 *       <CardHeader>
 *         <CardTitle>Title</CardTitle>
 *         <CardDescription>Desc</CardDescription>
 *       </CardHeader>
 *       <CardContent>Body</CardContent>
 *     </Card>
 */
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-lg border bg-card text-card-foreground shadow-sm",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-2xl font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
