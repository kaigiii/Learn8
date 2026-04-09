# Base image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (needed for some python packages like chromadb/sqlite)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Common Lisp dependencies for ChromaDB (if needed internally) or just ensure clean env
# (ChromaDB usually works fine with basic build-essential)

# Copy requirements first to leverage cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make entrypoint script executable
RUN chmod +x ./entrypoint.sh

# Expose port
EXPOSE 8000

# Set entrypoint to run migrations automatically
ENTRYPOINT ["./entrypoint.sh"]

# Command to run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
