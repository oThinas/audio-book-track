import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleEditorsList } from "@/app/api/v1/editors/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { EditorService } from "@/lib/services/editor-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

describe("handleEditorsList", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("returns 200 with empty array when no editors exist", async () => {
    const response = await handleEditorsList(
      new Request("http://localhost/api/v1/editors"),
      buildContext(),
      { createService: () => service },
    );
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

    const response = await handleEditorsList(
      new Request("http://localhost/api/v1/editors"),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string; email: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.data.map((e) => e.id)).toEqual([first.id, second.id, third.id]);
    expect(body.data[0]).toMatchObject({ id: first.id, name: "Carla", email: "1@s.com" });
  });

  it("sets Cache-Control: no-store header", async () => {
    const response = await handleEditorsList(
      new Request("http://localhost/api/v1/editors"),
      buildContext(),
      { createService: () => service },
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
