.PHONY: all build up down logs restart test health train clean

all: up

build:
	docker compose build

up:
	docker compose up --build -d

down:
	docker compose down

restart:
	docker compose down && docker compose up -d

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

health:
	@curl -s http://localhost:8000/api/v1/health | grep -o '"status":"healthy"' && echo " Backend is healthy" || echo "❌ Backend health check failed"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200" && echo " Frontend is responding" || echo "❌ Frontend check failed"

test:
	docker compose exec backend python /app/backend/tests/test_api.py -v
	@echo "All API integration tests passed successfully!"

clean:
	docker compose down -v
