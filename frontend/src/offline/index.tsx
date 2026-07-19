import React from "react";
import ReactDOM from "react-dom/client";
import { OfflineCoursePlayer } from "./OfflineCoursePlayer";

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<OfflineCoursePlayer />);
}
