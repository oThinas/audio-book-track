import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEditorsList } from "@/app/api/v1/editors/route";
import { EditorService } from "@/lib/services/editor-service";

function createDeps(options: { session: { user: { id: string } } | null; service: EditorService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

describe("GET /api/v1/editors (handleEditorsList)", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleEditorsList(deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: expect.any(String) },
    });
  });

  it("returns 200 with empty array when no editors exist", async () => {
    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleEditorsList(deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  it("returns 200 with editors ordered by createdAt ASC", async () => {
    const first = await repo.create({ name: "Carla", email: "1@s.com" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await repo.create({ name: "Bruno", email: "2@s.com" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const third = await repo.create({ name: "Ana", email: "3@s.com" });

    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleEditorsList(deps);
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string; email: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.data.map((e) => e.id)).toEqual([first.id, second.id, third.id]);
    expect(body.data[0]).toMatchObject({ id: first.id, name: "Carla", email: "1@s.com" });
  });

  it("sets Cache-Control: no-store header", async () => {
    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleEditorsList(deps);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
