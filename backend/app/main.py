from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router

app = FastAPI(title=settings.PROJECT_NAME)

cors_allow_origins = [
    origin.strip() for origin in settings.CORS_ALLOW_ORIGINS.split(",") if origin.strip()
]
if not cors_allow_origins:
    cors_allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {"message": "Welcome to Learn8 API"}
