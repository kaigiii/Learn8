import sys
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.user import UserModel
from app.core.security import create_access_token

def test_route():
    db = SessionLocal()
    user = db.query(UserModel).first()
    token = create_access_token(user.id)
    
    client = TestClient(app)
    response = client.get(
        "/api/v1/arena/admin/public-courses/6/available-questions",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"Status Code: {response.status_code}")
    try:
        import json
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)

if __name__ == "__main__":
    test_route()
