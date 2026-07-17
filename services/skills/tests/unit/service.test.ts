import { describe, expect, it } from "vitest";
import { createSkillsService } from "../../src/service.js";

describe("skills service scaffold", () => {
  it("manages lifecycle and descriptor", async () => {
    const service = createSkillsService();
    expect(service.getDescriptor().serviceName).toBe("skills");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });

  it("registers and lists skills", async () => {
    const service = createSkillsService();
    await service.start();
    await expect(
      service.registerSkill(
        {
          id: "skill.echo",
          version: "1.0.0",
          name: "Echo Skill",
          description: "echoes input"
        },
        async (args) => args
      )
    ).resolves.toEqual({ registered: true });
    await expect(service.listSkills()).resolves.toMatchObject([
      {
        id: "skill.echo",
        version: "1.0.0",
        name: "Echo Skill"
      }
    ]);
  });

  it("executes registered skills and returns deterministic errors", async () => {
    const service = createSkillsService();
    await service.start();
    await service.registerSkill(
      {
        id: "skill.sum",
        version: "1.0.0",
        name: "Sum Skill",
        description: "adds two numbers"
      },
      async (args) => Number(args?.a ?? 0) + Number(args?.b ?? 0)
    );

    await expect(
      service.executeSkill({
        skillId: "skill.sum",
        args: { a: 2, b: 3 }
      })
    ).resolves.toEqual({ ok: true, output: 5 });
    await expect(service.executeSkill({ skillId: "skill.unknown" })).resolves.toEqual({
      ok: false,
      error: {
        code: "SKILL_NOT_FOUND",
        message: "skill not found: skill.unknown"
      }
    });
  });
});
