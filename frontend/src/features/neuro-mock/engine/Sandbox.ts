import type { InterventionPort, SandboxAction, SandboxState } from "../contract";
export class Sandbox implements InterventionPort {
  state: SandboxState = { phase: "learning", variant: "original", objective: "辨認等值分數：1/2 = 4/8", hintVisible: false, answerCorrect: null, breakRemainingMs: 0, calibrationRemainingMs: 0, breakAfterQuestion: false, breaksMuted: false, message: "原題會一直保留，學習目標不變。" };
  act(action: SandboxAction, _timestampMs = 0) {
    const s = this.state;
    if (action === "hint") this.state = { ...s, hintVisible: true, message: "把八片分成兩份，每份四片。先看一個具體例子。" };
    if (action === "simplify") this.state = { ...s, variant: "simple", message: "先比較兩個區塊；原題仍然保留。" };
    if (action === "swap") this.state = { ...s, variant: "visual", answerCorrect: null, message: "同一概念・另一種方式。完成後可以回到原題確認。" };
    if (action === "return-original") this.state = { ...s, variant: "original", answerCorrect: null, message: "回到原題，確認相同的學習目標。" };
    if (action === "break") this.state = { ...s, phase: "break", breakRemainingMs: 120000, breakAfterQuestion: false, message: "休息是學習的一部分，隨時可以提早回來。" };
    if (action === "return") this.state = { ...s, phase: "recalibrating", calibrationRemainingMs: 12000, message: "重新建立 12 秒模擬基準，再回到剛才的題目。" };
    if (action === "after-question") this.state = { ...s, breakAfterQuestion: true, message: "完成這題後再休息，由你決定。" };
    if (action === "mute-breaks") this.state = { ...s, breaksMuted: true, message: "本次 session 不再提出休息建議。" };
    if (action === "finish") this.state = { ...s, phase: "ended", message: "回顧哪些互動對這次模擬有幫助。" };
    if (action === "continue") this.state = { ...s, phase: "learning" };
  }
  answer(correct: boolean, _timestampMs = 0) {
    this.state = { ...this.state, answerCorrect: correct, message: correct ? "你辨認出同樣的份量了。可以回原題確認，或繼續。" : "可以先看例子，再用自己的節奏試一次。" };
    if (correct && this.state.breakAfterQuestion) this.act("break");
  }
  tick(qualityGood: boolean) {
    if (this.state.phase === "break") {
      this.state = { ...this.state, breakRemainingMs: Math.max(0, this.state.breakRemainingMs - 100) };
      if (!this.state.breakRemainingMs) this.act("return");
    } else if (this.state.phase === "recalibrating" && qualityGood) {
      this.state = { ...this.state, calibrationRemainingMs: Math.max(0, this.state.calibrationRemainingMs - 100) };
      if (!this.state.calibrationRemainingMs) this.state = { ...this.state, phase: "learning", message: "模擬基準已更新，繼續剛才的學習目標。" };
    }
  }
}
