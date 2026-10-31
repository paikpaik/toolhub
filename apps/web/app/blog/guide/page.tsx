import Link from "next/link";
import { Fragment } from "react";
import { GUIDES, type GuideSection } from "./content";

/** **굵게**와 `코드`만 처리한다 */
function Rich({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith("`") ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Section({ section }: { section: GuideSection }) {
  const List = section.kind === "steps" ? "ol" : "ul";
  return (
    <section className={`card guide-section ${section.kind}`}>
      <h2>{section.title}</h2>
      <List className="guide-list">
        {section.items.map((item) => (
          <li key={item}>
            <Rich text={item} />
          </li>
        ))}
      </List>
    </section>
  );
}

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const guide = GUIDES.find((g) => g.key === p) ?? GUIDES[0]!;
  const [steps, ...rest] = guide.sections;

  return (
    <main className="guide">
      <header>
        <h1>
          작성 가이드 <small>플랫폼별 발행 순서 · 수익 · 품질</small>
        </h1>
      </header>

      <nav className="guide-tabs" aria-label="플랫폼">
        {GUIDES.map((g) => (
          <Link key={g.key} href={g.key === "common" ? "/blog/guide" : `/blog/guide?p=${g.key}`} className={g === guide ? "active" : undefined}>
            {g.label}
          </Link>
        ))}
      </nav>

      <p className="guide-intro">{guide.intro}</p>

      <div className="stat-cards guide-facts">
        {guide.facts.map((f) => (
          <div key={f.label} className="card stat-card">
            <span className="stat-label">{f.label}</span>
            <span className="guide-fact">{f.value}</span>
          </div>
        ))}
      </div>

      {steps && <Section section={steps} />}
      <div className="guide-grid">
        {rest.map((s) => (
          <Section key={s.title} section={s} />
        ))}
      </div>

      <section className="card guide-section">
        <h2>공식 안내</h2>
        <p className="muted guide-note">가입 기준·광고 정책은 바뀔 수 있어요. 수치가 필요한 내용은 공식 안내에서 확인하세요.</p>
        <ul className="guide-links">
          {guide.links.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
