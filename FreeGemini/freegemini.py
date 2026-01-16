import requests
import os
import sys
import json
import datetime
import pathspec

class ProjectMemory:
    # client/projects_pool
    # client/projects_pool
    # Use centralized config if available
    try:
        from .config import PROJECTS_POOL
    except ImportError:
        try:
             import config
             PROJECTS_POOL = config.PROJECTS_POOL
        except ImportError:
             # Fallback if config not found
             BASE_DIR = os.path.dirname(os.path.abspath(__file__))
             PROJECTS_POOL = os.path.join(BASE_DIR, "projects_pool")

    @staticmethod
    def _get_start_dirs(pid: str):
        p_root = os.path.join(ProjectMemory.PROJECTS_POOL, pid)
        hist_dir = os.path.join(p_root, "history")
        art_dir = os.path.join(p_root, "artifacts")
        os.makedirs(hist_dir, exist_ok=True)
        os.makedirs(art_dir, exist_ok=True)
        return hist_dir, art_dir

    @staticmethod
    def append_history(pid: str, sender: str, content: str):
        """將對話紀錄寫入本地檔案"""
        hist_dir, _ = ProjectMemory._get_start_dirs(pid)
        f_path = os.path.join(hist_dir, "history_full.md")
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(f_path, "a", encoding="utf-8") as f:
            f.write(f"\n### [{ts}] {sender}\n{content}\n\n---\n")

    @staticmethod
    def generate_snapshot(pid: str, root: str = ".") -> str:
        """生成專案快照 (Context Snapshot)"""
        # 1. Setup Ignore Spec
        pats = ['.git/', 'context_snapshot.md', '__pycache__/', 'venv/', 'node_modules/', '.DS_Store']
        # Also ignore projects_pool to avoid loop
        pats.append('projects_pool/')
        
        if os.path.exists(os.path.join(root, '.gitignore')):
            with open(os.path.join(root, '.gitignore')) as f: pats.extend(f.readlines())
        spec = pathspec.PathSpec.from_lines('gitwildmatch', pats)
        
        _, art_dir = ProjectMemory._get_start_dirs(pid)
        out = os.path.join(art_dir, "context_snapshot.md")
        
        lines = [f"**Project Root: {os.path.abspath(root)}**"]
        
        # 2. Build Tree
        def _tree(d, p=""):
            try: items = sorted(os.listdir(d))
            except: return
            # Filter
            filt = []
            for i in items:
                # SKIP projects_pool if it is in the root
                if i == "projects_pool" and os.path.abspath(os.path.join(d, i)) == ProjectMemory.PROJECTS_POOL:
                    continue
                    
                rel = os.path.relpath(os.path.join(d, i), root)
                if os.path.isdir(os.path.join(d, i)): rel += "/"
                if not spec.match_file(rel):
                    filt.append(i)
            
            for i, item in enumerate(filt):
                full = os.path.join(d, item)
                last = (i == len(filt) - 1)
                lines.append(f"{p}{'└── ' if last else '├── '}{item}{'/' if os.path.isdir(full) else ''}")
                if os.path.isdir(full): _tree(full, p + ("    " if last else "│   "))
        _tree(root)
        
        # 3. Write Content
        with open(out, 'w', encoding='utf-8') as md:
            md.write(f"# Snapshot\n> {datetime.datetime.now()}\n\n## 1. Structure\n```text\n{str(chr(10)).join(lines)}\n```\n\n## 2. Content\n")
            for r, _, fs in os.walk(root):
                # Skip projects_pool in walk
                if os.path.abspath(r).startswith(ProjectMemory.PROJECTS_POOL):
                    continue
                    
                for f in sorted(fs):
                    fp = os.path.join(r, f)
                    rel = os.path.relpath(fp, root)
                    if spec.match_file(rel) or f == "context_snapshot.md": continue
                    # Skip potentially binary or large files simple check
                    try:
                        with open(fp, 'rb') as tf: 
                            if b'\0' in tf.read(1024): continue
                        with open(fp, 'r', encoding='utf-8') as tf: 
                            md.write(f"### {rel}\n```\n{tf.read()}\n```\n\n---\n")
                    except: pass
        return out

# === 1. The Class (For Advanced Usage) ===
class FreeGeminiClient:
    """
    Client for the FreeGemini Server.
    Allows managing specific server connections and configurations.
    """
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self._logged_in_pids = set()

    def login(self, pid: str):
        """
        Trigger the login flow on the server for the given project/session ID.
        This opens the browser on the server machine.
        """
        url = f"{self.base_url}/sessions/init_login/{pid}"
        try:
            response = requests.post(url)
            response.raise_for_status()
            print(f"✅ Login initiated for '{pid}'. Please check the server window.")
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Login Request Failed: {str(e)}")
            return {"status": "error", "message": f"Login Request Failed: {str(e)}"}

    def chat(
        self,
        pid: str, 
        text: str, 
        memory: bool = True,
        files: list = None,
        model: str = "1",
        project_root: str = "."
    ):
        """
        Send a message to the AI.
        
        Args:
            pid (str): Project ID (Unique identifier for the project).
            text (str): Your message/prompt.
            memory (bool): If True, uploads project context (snapshot). If False, stateless chat.
            files (list): List of file paths to upload (e.g., ["image.png", "data.csv"]).
            model (str): "1" (Fast), "2" (Pro), "3" (Thinking).
            project_root (str): The root directory to snapshot. Defaults to CWD (".").
        """
        # [NEW] Auto-Login Check (Server-Side + Local Cache)
        if pid not in self._logged_in_pids:
            # Check Server Status
            try:
                check_url = f"{self.base_url}/sessions/{pid}/status"
                res = requests.get(check_url, timeout=2)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("exists") and data.get("status") == "active":
                        print(f"✅ Session '{pid}' exists on server. Skipping login.")
                        self._logged_in_pids.add(pid)
                    else:
                        print(f"ℹ️ Session '{pid}' missing locally and on server. Initiating login...")
                        self.login(pid)
                        self._logged_in_pids.add(pid)
                else:
                    # Fallback if endpoint not found (older server?)
                    self.login(pid)
                    self._logged_in_pids.add(pid)
            except Exception as e:
                print(f"⚠️ Session check failed ({e}). Defaulting to login.")
                self.login(pid)
                self._logged_in_pids.add(pid)

        url = f"{self.base_url}/api/freegemini/chat"
        
        # [NEW] Client-Side Context Management
        if ProjectMemory:
            # 1. Log User Message
            ProjectMemory.append_history(pid, "User", text)
            
            # 2. Generate Snapshot (if memory is on)
            if memory:
                print(f"📸 Generating Project Snapshot (root: {os.path.abspath(project_root)})...")
                try:
                    snapshot_path = ProjectMemory.generate_snapshot(pid, project_root)
                    if snapshot_path:
                        if files is None: files = []
                        files.append(snapshot_path)
                except Exception as e:
                    print(f"⚠️ Snapshot generation failed: {e}")

        # Payload
        payload = {
            "pid": pid,
            "text": text,
            "model": model,
            "memory": memory
        }

        # Files
        files_payload = []
        open_files = [] # Keep track to close later
        
        if files:
            for file_path in files:
                if os.path.exists(file_path):
                    f = open(file_path, 'rb')
                    open_files.append(f)
                    # 'upload_files' matches FastAPI List[UploadFile]
                    files_payload.append(('upload_files', (os.path.basename(file_path), f)))
                else:
                    print(f"⚠️ Warning: File not found: {file_path}")

        try:
            response = requests.post(url, data=payload, files=files_payload if files_payload else None)
            response.raise_for_status()
            res_json = response.json()
            
            # [NEW] Log AI Reply
            if ProjectMemory and "reply" in res_json:
                ProjectMemory.append_history(pid, "AI", res_json["reply"])
            
            return res_json
        except requests.exceptions.RequestException as e:
            return {"status": "error", "message": f"Network Error: {str(e)}"}
        finally:
            for f in open_files:
                f.close()



