import { OfflineCourseData } from "./OfflineCoursePlayer";

export const FALLBACK_COURSE_DATA: OfflineCourseData = {
  courseTitle: "載入中的課程...",
  description: "請在系統中點選匯出產出此檔案。",
  units: [
    {
      unitId: "unit-1",
      unitTitle: "第一單元：離線播放器測試",
      unitDescription: "測試離線模式下的版面與狀態",
      nodes: [
        {
          id: "node-1",
          title: "投影片示範",
          description: "如何使用離線課程播放器",
          status: "available",
          stages: [
            {
              stageId: "stage-1",
              component: "explainer-media",
              topic: "離線播放器指南",
              feedback: { success: "讚！已了解離線播放器。" },
              config: {
                data: {
                  title: "歡迎使用離線播放器！",
                  markdown: "這是一個完全獨立的 HTML 網頁。你可以：\n\n1. 在左側**點選解鎖的關卡**以進入學習。\n2. 在右側播放器**操作原版互動式元件**（答錯亦有反饋）。\n3. 物理斷網下仍能流暢運行。\n\n點選下方按鈕繼續！"
                }
              }
            },
            {
              stageId: "stage-2",
              component: "MultipleChoice",
              topic: "離線播放器測試題",
              feedback: { success: "答對了！你太優秀了。", error: "答錯囉，離線版是不可以重新生成題目的喔！" },
              config: {
                data: {
                  question: "離線播放器最大的特點是什麼？",
                  options: [
                    { id: "opt-1", text: "需要持續連接資料庫" },
                    { id: "opt-2", text: "免裝伺服器，100% 保留原版互動元件與視覺" },
                    { id: "opt-3", text: "所有功能都被拔除，只剩文字" }
                  ],
                  correctOptionId: "opt-2",
                  explanation: "我們透過單一 HTML SPA 技術將 React 原件打包，能在離線下提供一模一樣的互動功能！"
                }
              }
            }
          ]
        }
      ]
    }
  ]
};
