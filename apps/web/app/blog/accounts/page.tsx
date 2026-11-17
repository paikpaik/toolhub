import { accountTopicStats, effectiveStatus, readAccounts, readDraftStatuses } from "@toolhub/collector";
import { DATA_DIR } from "../../../lib/data";
import { THUMBNAIL_FONTS } from "../thumbnail/fonts";
import { AccountsEditor } from "./accounts-editor";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, statuses] = await Promise.all([readAccounts(DATA_DIR), readDraftStatuses(DATA_DIR)]);
  const entries = Object.values(statuses).map((e) => ({ account: e.account, topic: e.topic, status: effectiveStatus(e) }));
  const stats = Object.fromEntries(accounts.map((a) => [a.id, accountTopicStats(a.id, entries)]));

  return (
    <main>
      <header>
        <h1>
          계정 <small>계정마다 분야를 정하면 초안을 계정별로 나눠 써요</small>
        </h1>
      </header>
      <p className="notice">
        계정을 등록하고 선호 분야를 고르면, Claude 앱에서 &ldquo;이 키워드들로 오늘 3개의 계정으로 네이버에 쓸 초안 15개를 작성해줘&rdquo;라고 할 때 계정마다
        자기 분야의 상위 키워드로 5개씩 써요. 계정끼리는 키워드가 겹쳐도 되지만 형식·각도를 다르게 씁니다. 계정을 하나도 등록하지 않으면 지금처럼 써요.
      </p>
      <AccountsEditor initial={accounts} stats={stats} fonts={THUMBNAIL_FONTS} />
    </main>
  );
}
