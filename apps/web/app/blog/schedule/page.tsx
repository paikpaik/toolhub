import { SchedulePicker } from "./schedule-picker";

export default function SchedulePage() {
  return (
    <main>
      <header>
        <h1>
          예약 발행 <small>하나는 바로 올리고 나머지는 랜덤 시간에 예약</small>
        </h1>
      </header>
      <SchedulePicker />
    </main>
  );
}
