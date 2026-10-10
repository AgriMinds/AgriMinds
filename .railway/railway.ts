import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "AgriMinds";
export default defineRailway(() => {
  const AgriMinds = service("AgriMinds", {
    source: github("AgriMinds/AgriMinds", { branch: "main", upstreamUrl: "https://github.com/AgriMinds/AgriMinds" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "frontend/Dockerfile", watchPatterns: ["frontend/**", "packages/**"] },
    start: "node frontend/server.js",
    healthcheck: "/login",
    healthcheckTimeout: 30,
    replicas: { "europe-west4-drams3a": 1 },
    networking: { privateNetworkEndpoint: "agriminds" },
  });

  const backend = service("backend", {
    source: github("AgriMinds/AgriMinds", { branch: "main", upstreamUrl: "https://github.com/AgriMinds/AgriMinds" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "backend/Dockerfile", watchPatterns: ["backend/**", "ml/**", "pyproject.toml", "uv.lock"] },
    healthcheck: "/api/v1/health",
    healthcheckTimeout: 60,
    replicas: { "europe-west4-drams3a": 1 },
    networking: { privateNetworkEndpoint: "backend", tcpProxies: { 8000: {} } },
  });

  return project("imaginative-rejoicing", {
    variables: { managed: false },
    resources: [AgriMinds, backend],
  });
});
