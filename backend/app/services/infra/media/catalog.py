import re
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.course_media_asset import CourseMediaAssetModel


@dataclass(frozen=True)
class MediaCatalogItem:
    index: int
    source_filename: str
    asset_filename: str | None
    asset_url: str | None
    description: str | None
    page_number: int | None


IMAGE_ALT_PATTERN = re.compile(r"!\[(?P<alt>.*?)\]\((?P<url>[^)]+)\)")
IMAGE_FILENAME_PATTERN = re.compile(r"p(?P<page>\d+)_img(?P<idx>\d+)", re.IGNORECASE)


def extract_image_captions(markdown: str) -> list[tuple[str, str]]:
    if not markdown:
        return []
    return [(m.group("alt").strip(), m.group("url").strip()) for m in IMAGE_ALT_PATTERN.finditer(markdown)]


def parse_image_filename(filename: str | None) -> tuple[int | None, int | None]:
    if not filename:
        return None, None
    match = IMAGE_FILENAME_PATTERN.search(filename)
    if not match:
        return None, None
    return int(match.group("page")), int(match.group("idx"))


def refresh_course_media_assets(
    db: Session,
    *,
    course_id: int | None,
    user_id: int | None,
    source_filename: str,
    markdown: str,
) -> list[CourseMediaAssetModel]:
    if course_id is None or user_id is None:
        return []

    db.query(CourseMediaAssetModel).filter(
        CourseMediaAssetModel.course_id == course_id,
        CourseMediaAssetModel.source_filename == source_filename,
    ).delete()

    entries = extract_image_captions(markdown)
    created: list[CourseMediaAssetModel] = []
    for index, (alt_text, url) in enumerate(entries, start=1):
        asset_filename = url.split("/")[-1] if url else None
        page_number, asset_index = parse_image_filename(asset_filename)
        asset = CourseMediaAssetModel(
            user_id=user_id,
            course_id=course_id,
            source_filename=source_filename,
            asset_type="image",
            asset_filename=asset_filename,
            asset_url=url,
            description=alt_text or None,
            page_number=page_number,
            asset_index=asset_index,
        )
        db.add(asset)
        created.append(asset)

    db.commit()
    return created


def build_media_catalog(
    items: Iterable[CourseMediaAssetModel],
) -> list[MediaCatalogItem]:
    return [
        MediaCatalogItem(
            index=i,
            source_filename=item.source_filename,
            asset_filename=item.asset_filename,
            asset_url=item.asset_url,
            description=item.description,
            page_number=item.page_number,
        )
        for i, item in enumerate(items, start=1)
    ]


def build_media_index_map(items: Iterable[MediaCatalogItem]) -> dict[int, MediaCatalogItem]:
    return {item.index: item for item in items}


def format_media_catalog(items: Iterable[MediaCatalogItem]) -> str:
    lines = ["AVAILABLE IMAGE CATALOG (use index to select):"]
    for item in items:
        desc = item.description or "No description"
        label = item.asset_filename or item.asset_url or "unknown"
        source = item.source_filename
        page = f"page {item.page_number}" if item.page_number else "page ?"
        lines.append(f"{item.index}. [{source}] {label} ({page}) - {desc}")
    return "\n".join(lines)
