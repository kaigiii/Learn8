"""
Module: app.services.commons.activity_logger
Description: Centralized Activity Logging Service

Provides structured logging for all user activities with detailed context.
Logs are written to both console and file with rotation.

Usage:
    from app.services.commons.activity_logger import ActivityLogger
    ActivityLogger.log_login(user_email="john@example.com")
"""

import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import Optional, List, Dict, Any

# Configure log directory
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Configure logger
activity_logger = logging.getLogger("activity")
activity_logger.setLevel(logging.INFO)
activity_logger.propagate = False  # Prevent duplicate logs

# File handler with rotation (10MB per file, keep 5 backups)
file_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "activity.log"),
    maxBytes=10 * 1024 * 1024,
    backupCount=5,
    encoding="utf-8"
)
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
activity_logger.addHandler(file_handler)

# Console handler for development
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(
    "📋 %(asctime)s | %(message)s",
    datefmt="%H:%M:%S"
))
activity_logger.addHandler(console_handler)


class ActivityLogger:
    """
    Centralized activity logging for user actions.
    All methods are static for easy access across the application.
    """

    @staticmethod
    def _format_user(user_id: int, user_email: str) -> str:
        return f"User[{user_id}:{user_email}]"

    @staticmethod
    def _format_project(project_id: int, project_name: str) -> str:
        return f"Project[{project_id}:{project_name}]"

    @staticmethod
    def _truncate(text: str, max_len: int = 100) -> str:
        if not text:
            return ""
        return text[:max_len] + "..." if len(text) > max_len else text

    # ==================== AUTH ====================

    @staticmethod
    def log_login(user_id: int, user_email: str):
        activity_logger.info(
            f"LOGIN | {ActivityLogger._format_user(user_id, user_email)} logged in successfully"
        )

    @staticmethod
    def log_login_failed(email: str, reason: str = "Invalid credentials"):
        activity_logger.warning(
            f"LOGIN_FAILED | Email={email} | Reason: {reason}"
        )

    @staticmethod
    def log_register(user_id: int, user_email: str):
        activity_logger.info(
            f"REGISTER | {ActivityLogger._format_user(user_id, user_email)} created new account"
        )

    @staticmethod
    def log_profile_edit(user_id: int, user_email: str, fields_changed: List[str]):
        activity_logger.info(
            f"PROFILE_EDIT | {ActivityLogger._format_user(user_id, user_email)} updated fields: {', '.join(fields_changed)}"
        )

    # ==================== PROJECTS ====================

    @staticmethod
    def log_project_create(user_id: int, user_email: str, project_id: int, project_name: str):
        activity_logger.info(
            f"PROJECT_CREATE | {ActivityLogger._format_user(user_id, user_email)} created {ActivityLogger._format_project(project_id, project_name)}"
        )

    @staticmethod
    def log_project_update(user_id: int, user_email: str, project_id: int, old_name: str, new_name: str):
        activity_logger.info(
            f"PROJECT_UPDATE | {ActivityLogger._format_user(user_id, user_email)} renamed Project[{project_id}] from '{old_name}' to '{new_name}'"
        )

    @staticmethod
    def log_project_delete(user_id: int, user_email: str, project_id: int, project_name: str):
        activity_logger.info(
            f"PROJECT_DELETE | {ActivityLogger._format_user(user_id, user_email)} deleted {ActivityLogger._format_project(project_id, project_name)}"
        )

    # ==================== FILES ====================

    @staticmethod
    def log_file_upload(user_id: int, user_email: str, project_id: int, project_name: str, filenames: List[str]):
        files_str = ", ".join(filenames)
        activity_logger.info(
            f"FILE_UPLOAD | {ActivityLogger._format_user(user_id, user_email)} uploaded to {ActivityLogger._format_project(project_id, project_name)}: [{files_str}]"
        )

    @staticmethod
    def log_file_delete(user_id: int, user_email: str, project_id: int, project_name: str, filename: str):
        activity_logger.info(
            f"FILE_DELETE | {ActivityLogger._format_user(user_id, user_email)} deleted '{filename}' from {ActivityLogger._format_project(project_id, project_name)}"
        )

    # ==================== QUESTIONNAIRE ====================

    @staticmethod
    def log_questionnaire_generate(
        user_id: int,
        user_email: str,
        project_id: int,
        project_name: str,
        topic: str,
        files_used: Optional[List[str]] = None
    ):
        files_str = ", ".join(files_used) if files_used else "None"
        activity_logger.info(
            f"QUESTIONNAIRE_GENERATE | {ActivityLogger._format_user(user_id, user_email)} started questionnaire for {ActivityLogger._format_project(project_id, project_name)} | "
            f"Topic: '{ActivityLogger._truncate(topic)}' | Files: [{files_str}]"
        )

    @staticmethod
    def log_questionnaire_submit(
        user_id: int,
        user_email: str,
        project_id: int,
        project_name: str,
        topic: str,
        learner_profile_summary: str
    ):
        activity_logger.info(
            f"QUESTIONNAIRE_SUBMIT | {ActivityLogger._format_user(user_id, user_email)} submitted questionnaire for {ActivityLogger._format_project(project_id, project_name)} | "
            f"Topic: '{ActivityLogger._truncate(topic)}' | Profile Summary: '{ActivityLogger._truncate(learner_profile_summary, 200)}'"
        )

    # ==================== SYLLABUS / COURSE ====================

    @staticmethod
    def log_syllabus_generate_start(
        user_id: int,
        user_email: str,
        project_id: int,
        project_name: str,
        topic: str,
        user_prompt: Optional[str] = None,
        rag_context_preview: Optional[str] = None,
        questionnaire_profile: Optional[str] = None,
        files_context: Optional[List[str]] = None
    ):
        activity_logger.info(
            f"SYLLABUS_GENERATE_START | {ActivityLogger._format_user(user_id, user_email)} started syllabus generation for {ActivityLogger._format_project(project_id, project_name)} | "
            f"Topic: '{ActivityLogger._truncate(topic)}'"
        )
        if user_prompt:
            activity_logger.info(f"  └─ User Prompt: '{ActivityLogger._truncate(user_prompt, 200)}'")
        if files_context:
            activity_logger.info(f"  └─ Files Context: [{', '.join(files_context)}]")
        if rag_context_preview:
            activity_logger.info(f"  └─ RAG Context: '{ActivityLogger._truncate(rag_context_preview, 300)}'")
        if questionnaire_profile:
            activity_logger.info(f"  └─ Learner Profile: '{ActivityLogger._truncate(questionnaire_profile, 200)}'")

    @staticmethod
    def log_syllabus_generate_complete(
        user_id: int,
        user_email: str,
        project_id: int,
        project_name: str,
        topic: str,
        units_count: int,
        lessons_count: int,
        unit_titles: Optional[List[str]] = None
    ):
        activity_logger.info(
            f"SYLLABUS_GENERATE_COMPLETE | {ActivityLogger._format_user(user_id, user_email)} completed syllabus for {ActivityLogger._format_project(project_id, project_name)} | "
            f"Topic: '{ActivityLogger._truncate(topic)}' | Generated: {units_count} units, {lessons_count} lessons"
        )
        if unit_titles:
            for i, title in enumerate(unit_titles, 1):
                activity_logger.info(f"  └─ Unit {i}: {title}")

    @staticmethod
    def log_syllabus_refine(
        user_id: int,
        user_email: str,
        project_id: int,
        project_name: str,
        topic: str,
        user_feedback: str
    ):
        activity_logger.info(
            f"SYLLABUS_REFINE | {ActivityLogger._format_user(user_id, user_email)} requested refinement for {ActivityLogger._format_project(project_id, project_name)} | "
            f"Topic: '{ActivityLogger._truncate(topic)}' | Feedback: '{ActivityLogger._truncate(user_feedback, 200)}'"
        )

    # ==================== CREDITS ====================

    @staticmethod
    def log_credits_topup(user_id: int, user_email: str, amount: int, new_balance: int):
        activity_logger.info(
            f"CREDITS_TOPUP | {ActivityLogger._format_user(user_id, user_email)} topped up {amount} credits | New balance: {new_balance}"
        )

    @staticmethod
    def log_credits_deduct(user_id: int, user_email: str, amount: int, reason: str, new_balance: int):
        activity_logger.info(
            f"CREDITS_DEDUCT | {ActivityLogger._format_user(user_id, user_email)} spent {amount} credits for '{reason}' | New balance: {new_balance}"
        )
