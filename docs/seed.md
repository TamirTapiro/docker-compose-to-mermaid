# Docker Compose → Mermaid Architecture Visualizer

## 1. Project Overview

### Project Name
docker-compose-mermaid (working name)

### Summary
A developer tool that converts Docker Compose configurations into architecture diagrams using Mermaid syntax. The tool analyzes Docker Compose files and generates diagrams representing services, networks, volumes, dependencies, and inferred connections.

The generated diagrams can be rendered directly in:

- GitHub README files
- Markdown documentation
- Mermaid viewers
- VSCode preview
- Static architecture documentation

The tool is designed to run locally as a CLI and optionally integrate with GitHub Actions and a VSCode extension.

---

# 2. Core Goals

### Primary Goals

1. Convert docker-compose files into Mermaid architecture diagrams
2. Automatically infer service relationships
3. Generate architecture documentation automatically
4. Require no external servers or paid services
5. Work entirely offline

### Secondary Goals

- Improve architecture visibility
- Reduce manual architecture documentation
- Provide developer-friendly visualization
- Integrate easily into CI pipelines

---

# 3. Target Users

### Primary Users

Backend Engineers  
DevOps Engineers  
Platform Engineers  
Infrastructure Engineers  
Open Source Maintainers  

### Use Cases

- Visualize docker environments quickly
- Generate architecture docs automatically
- Improve onboarding documentation
- Understand complex service dependencies

---

# 4. Supported Input Files

The system should support parsing the following files:

### Required

docker-compose.yml

### Optional

docker-compose.override.yml  
docker-compose.dev.yml  
docker-compose.prod.yml  

### Future Support

compose.yaml  
compose.override.yaml  

---

# 5. Example Input

Example docker-compose file:

```yaml
version: "3.9"

services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    depends_on:
      - db
      - redis
    environment:
      DATABASE_URL: postgres://db:5432/app
    networks:
      - backend

  worker:
    build: ./worker
    depends_on:
      - redis
      - db
    networks:
      - backend

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    networks:
      - backend

  db:
    image: postgres:15
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - backend

networks:
  backend:

volumes:
  db_data: