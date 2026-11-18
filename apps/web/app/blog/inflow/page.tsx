import { INFLOW_KEEP_DAYS, INFLOW_PLAN_PER_ACCOUNT, inflowOverview, listDrafts, readAccounts, readDraftStatuses, readInflow } from "@toolhub/collector";
import { DATA_DIR, DRAFTS_DIR } from "../../../lib/data";
import { InflowList } from "./inflow-list";

export const dynamic = "force-dynamic";

/** 크롬 확장으로 복사해 Claude가 저장한 유입 검색어(data/inflow.json)를 계정별로 확인하고 지운다 */
export default async function InflowPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account = null } = await searchParams;
  const [accounts, store, all, statuses] = await Promise.all([readAccounts(DATA_DIR), readInflow(DATA_DIR), listDrafts(DRAFTS_DIR), readDraftStatuses(DATA_DIR)]);
  const drafts = all.map((d) => ({ keyword: d.keyword, account: statuses[d.file]?.account }));
  const items = inflowOverview(accounts, store, drafts);

  return (
    <main>
      <header>
        <h1>
          유입 검색어 <small>블로그 통계에서 복사해 저장한 검색어</small>
        </h1>
      </header>
      <p className="notice">
        확장의 <b>유입 검색어 복사</b>로 붙여넣은 기록이 계정마다 마지막 것 하나씩 저장돼요. <b>글감 후보</b>는 아직 글이 없는 검색어 중 비율 높은{" "}
        {INFLOW_PLAN_PER_ACCOUNT}개로, 글감을 고를 때 그 계정 후보로 나와요. 받은 지 {INFLOW_KEEP_DAYS}일이 지나면 후보에서 빠져요. 잘못 들어간 기록이나 후보로 쓰기 싫은 검색어는 여기서 지우세요.
      </p>
      <InflowList items={items} initialAccount={account} />
    </main>
  );
}
