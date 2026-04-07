import request, { SuperTest, Test } from "supertest";
import app from "../app";

describe("GET /api/health", () => {
  let server: SuperTest<Test>;

  beforeAll(() => {
    server = request(app);
  });

  it("should respond with 200 OK", async () => {
    const response = await server.get("/api/health").send();

    expect(response.status).toBe(200);
  });

  it("should respond with expected body", async () => {
    const response = await server.get("/api/health").send();

    expect(response.body).toBeDefined();
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("uptime");
    expect(response.body).toHaveProperty("timestamp");

    expect(response.body.status).toBe("ok");
    expect(typeof response.body.uptime).toBe("number");
    expect(typeof response.body.timestamp).toBe("string");
  });
});