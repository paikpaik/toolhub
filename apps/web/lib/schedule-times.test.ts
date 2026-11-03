import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatScheduleTime, pickScheduleTimes } from "./schedule-times.ts";

describe("예약 발행 시간 뽑기", () => {
  it("개수만큼, 10분 단위로, 첫 예약부터 기준 시각(10분 올림) 뒤로 간격 3~4시간", () => {
    for (let run = 0; run < 200; run++) {
      const times = pickScheduleTimes({ start: 9 * 60 + 7, count: 4 });
      assert.equal(times.length, 4);
      assert.ok(times.every((t) => t % 10 === 0));
      let prev = 9 * 60 + 10;
      for (const t of times) {
        assert.ok(t - prev >= 180 && t - prev <= 240, `간격 ${t - prev}분`);
        prev = t;
      }
    }
  });

  it("랜덤 값의 양끝에서도 범위를 지킨다", () => {
    assert.deepEqual(pickScheduleTimes({ start: 600, count: 3, random: () => 0 }), [780, 960, 1140]);
    assert.deepEqual(pickScheduleTimes({ start: 600, count: 3, random: () => 0.9999 }), [840, 1080, 1320]);
  });

  it("간격을 바꿀 수 있고, 최소·최대가 거꾸로거나 같아도 된다", () => {
    assert.deepEqual(pickScheduleTimes({ start: 0, count: 2, minGapMin: 60, maxGapMin: 60 }), [60, 120]);
    for (let run = 0; run < 50; run++) {
      const [a, b] = pickScheduleTimes({ start: 0, count: 2, minGapMin: 300, maxGapMin: 120 });
      assert.ok(a! >= 120 && a! <= 300 && b! - a! >= 120 && b! - a! <= 300);
    }
  });

  it("자정을 넘기면 다음 날 날짜로 보여 준다", () => {
    assert.equal(formatScheduleTime("2026-11-03", 14 * 60 + 30), "11월 3일(화) 14:30");
    assert.equal(formatScheduleTime("2026-11-03", 1440 + 70), "11월 4일(수) 01:10");
    assert.equal(formatScheduleTime("2026-12-31", 1440 + 5), "1월 1일(금) 00:05");
  });
});
