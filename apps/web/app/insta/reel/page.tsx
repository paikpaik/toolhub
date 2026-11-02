import { HOOK_FORMULAS, HOOK_RULES } from "@toolhub/insta";
import { CopyButton } from "../../blog/copy-button";
import { ReelChecker } from "./reel-checker";

export default function ReelPage() {
  return (
    <main>
      <header>
        <h1>
          릴스 대본 <small>훅 점검 · 초 단위 구성표 · 훅 공식 26가지</small>
        </h1>
      </header>

      <ReelChecker />

      <section>
        <h2>
          훅 공식 26가지 <small>아이디어에 맞는 공식 3개를 골라 훅 후보를 써 보세요</small>
        </h2>
        <ul className="hook-rules">
          {HOOK_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="hook-grid">
          {HOOK_FORMULAS.map((h) => (
            <details key={h.id} className="card hook-card">
              <summary>
                <span className="hook-id">{h.id}</span> {h.name} <small>{h.onScreen}</small>
              </summary>
              <dl>
                <dt>틀</dt>
                <dd>
                  {h.template} <CopyButton text={h.template} />
                </dd>
                <dt>예</dt>
                <dd>{h.example}</dd>
                <dt>자막</dt>
                <dd>{h.onScreen}</dd>
                <dt>잘 맞을 때</dt>
                <dd>{h.bestFor}</dd>
                <dt>망치는 법</dt>
                <dd>{h.trap}</dd>
              </dl>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
