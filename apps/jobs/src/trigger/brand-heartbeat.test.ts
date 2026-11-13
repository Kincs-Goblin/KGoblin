import { idempotencyKeys } from "@trigger.dev/sdk";
import { describe, expect, it, vi } from "vitest";

import { brandHeartbeatTask, triggerBrandHeartbeat } from "./brand-heartbeat";

describe("triggerBrandHeartbeat", () => {
  it("kulcsépítés előtt validálja a payloadot, és üres mezőre JOB.INVALID_PAYLOAD AppErrort dob", async () => {
    await expect(
      triggerBrandHeartbeat({ brandId: "gamer", correlationId: "" }),
    ).rejects.toMatchObject({
      code: "JOB.INVALID_PAYLOAD",
      retryable: false,
    });
  });

  it("kulcsépítés előtt validálja a brandet, és nem engedi át az eltérő kis-/nagybetűs vagy ismeretlen brandet", async () => {
    await expect(
      triggerBrandHeartbeat({ brandId: "Gamer", correlationId: "evt_003" }),
    ).rejects.toMatchObject({
      code: "BRAND.UNKNOWN_ID",
      retryable: false,
    });
  });

  it("érvényes gamer brand esetén globális idempotencia-kulcsot épít és meghívja a task.trigger-t", async () => {
    const createKeySpy = vi
      .spyOn(idempotencyKeys, "create")
      .mockResolvedValue("idem_hashed_key" as never);
    const triggerSpy = vi
      .spyOn(brandHeartbeatTask, "trigger")
      .mockResolvedValue({ id: "run_test_001" } as never);

    try {
      const handle = await triggerBrandHeartbeat({
        brandId: "gamer",
        correlationId: "evt_004",
      });

      expect(createKeySpy).toHaveBeenCalledWith("brand-heartbeat:gamer:evt_004", {
        scope: "global",
      });
      expect(triggerSpy).toHaveBeenCalledWith(
        { brandId: "gamer", correlationId: "evt_004" },
        { idempotencyKey: "idem_hashed_key" },
      );
      expect(handle).toEqual({ id: "run_test_001" });
    } finally {
      createKeySpy.mockRestore();
      triggerSpy.mockRestore();
    }
  });
});
