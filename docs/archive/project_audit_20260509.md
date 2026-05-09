# Learn8 Project Audit Report (2026-05-09)

## 1. Backend Analysis

### 1.1 Course Loading System (`backend/app/core/course_loader.py`)
- **[ISSUE] YAML Validation**: The loader lacks a strict schema validation layer. If a YAML file is missing required fields like `topic` or `units`, it can cause `KeyError` during startup or database synchronization.
- **[OPTIMIZATION] Incremental Sync**: Currently, `sync_to_db` performs a full sweep. As the number of courses grows, this will become slow. Consider using file hashing to only sync changed files.

### 1.2 Custom Course API (`backend/app/api/v1/endpoints/custom_courses.py`)
- **[ISSUE] Fragile Paths**: Relative path resolution using `.parent.parent.parent.parent.parent` is brittle.
  - *Recommendation*: Use `app.core.config.settings.BASE_DIR` or define a dedicated `DATA_DIR` in config.
- **[ISSUE] Blocking API Endpoints**: The `export_course_to_yaml` endpoint triggers a full registry reload (`_load_all`) and database sync. This is a blocking I/O operation that could lead to timeouts or performance degradation if multiple admins use it simultaneously.
  - *Recommendation*: Offload registry reloads to a background task or use a more granular update mechanism.
- **[ISSUE] Business Logic in API**: Mapping logic from course components to YAML structure is hardcoded in the endpoint.
  - *Recommendation*: Move this logic to a service layer (e.g., `CourseService` or `ExportService`).

### 1.3 Admin Service (`backend/app/arena/services/admin_service.py`)
- **[SAFETY] Array Access**: In `serialize_question_pool`, there's a direct access to `item.options_json[0]` for `FeynmanMirror` components. This will crash if `options_json` is empty.
  - *Recommendation*: Add a length check or use `.get()` safely.
- **[REDUNDANCY] Status Sync**: There is overlapping logic for syncing `is_published` between `admin_service.py` and `custom_courses.py`. This increases the risk of desynchronization if the logic is updated in one place but not the other.

## 2. Frontend Analysis

### 2.1 Course Management (`frontend/src/features/arena/components/PublicCourseManagementTab.tsx`)
- **[GOOD] UI/UX**: Excellent use of `framer-motion` and `DeepGlassCard` for a premium feel.
- **[OPTIMIZATION] State Management**: The tab relies heavily on full re-fetches (`fetchData`) after any action. For better perceived performance, consider optimistic UI updates or patching the local state.
- **[CLEANUP] Duplicate Preview Logic**: The preview modal logic is noted as "Copied from CourseReviewTab".
  - *Recommendation*: Extract the course preview into a shared component to avoid duplication.

## 3. General Project Structure

### 3.1 Environment Configuration
- The `.env.example` is present and well-maintained.
- `Settings` in `app/core/config.py` is well-structured and uses `pydantic-settings`.

### 3.2 Docker Support
- `docker-compose.yml` and `Dockerfile`s are present, indicating good deployment readiness.

## 4. Priority Recommendations

1.  **Implement YAML Schema Validation**: Use Pydantic models to validate YAML content before processing.
2.  **Fix Path Resolution**: Standardize directory paths in `config.py`.
3.  **Refactor Export Logic**: Move YAML generation and registry syncing to a background task or a dedicated service.
4.  **Extract Shared Components**: Modularize the course preview UI on the frontend.
