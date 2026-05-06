import argparse
from pathlib import Path
from typing import Optional

import torch
from torch import nn
from torchvision import models, transforms
from PIL import Image

DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "model.pth"
LABEL_MAP = {"meaningless": 0, "useful": 1}
_MODEL_CACHE: dict[tuple[str, str], nn.Module] = {}
_TRANSFORMS_CACHE: dict[int, transforms.Compose] = {}


def build_transforms(image_size: int) -> transforms.Compose:
    cached = _TRANSFORMS_CACHE.get(image_size)
    if cached is not None:
        return cached

    transform = transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    _TRANSFORMS_CACHE[image_size] = transform
    return transform


def build_model(num_classes: int) -> nn.Module:
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def _normalize_model_path(model_path: str | Path) -> str:
    return str(Path(model_path).expanduser().resolve())


def _get_device(device: torch.device | None = None) -> torch.device:
    return device or torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_model(model_path: str | Path, device: torch.device | None = None) -> nn.Module:
    model_path_str = _normalize_model_path(model_path)
    device = _get_device(device)
    cache_key = (model_path_str, str(device))

    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    model = build_model(num_classes=2)
    model.load_state_dict(torch.load(model_path_str, map_location=device))
    model.to(device)
    model.eval()
    _MODEL_CACHE[cache_key] = model
    return model


def predict_pil(
    image: Image.Image,
    model_path: str | Path = DEFAULT_MODEL_PATH,
    image_size: int = 224,
    device: torch.device | None = None,
) -> int:
    device = _get_device(device)
    model = load_model(model_path, device=device)
    val_tfms = build_transforms(image_size)
    if image.mode != "RGB":
        image = image.convert("RGB")

    tensor = val_tfms(image).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(tensor)
        return int(torch.argmax(outputs, dim=1).item())


def predict_image_bytes(
    image_bytes: bytes,
    model_path: str | Path = DEFAULT_MODEL_PATH,
    image_size: int = 224,
    device: torch.device | None = None,
) -> int:
    from io import BytesIO

    with Image.open(BytesIO(image_bytes)) as image:
        return predict_pil(image, model_path=model_path, image_size=image_size, device=device)


def predict(args: argparse.Namespace) -> int:
    image = Image.open(args.image_path)
    return predict_pil(
        image,
        model_path=args.model_path,
        image_size=args.image_size,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Image prediction: meaningless -> 0, useful -> 1")
    parser.add_argument(
        "--model-path",
        default=str(DEFAULT_MODEL_PATH),
        help="Path to the trained model",
    )
    parser.add_argument("--image-path", required=True, help="Path to an image file")
    parser.add_argument("--image-size", type=int, default=224)

    return parser.parse_args()


def main(image_path: Optional[str] = None) -> int:
    if image_path is None:
        args = parse_args()
    else:
        args = argparse.Namespace(
            model_path=str(DEFAULT_MODEL_PATH),
            image_path=image_path,
            image_size=224,
        )

    return predict(args)
