/** 실시간 키워드·키워드 분석처럼 외부 API를 기다리는 동안, 이전 화면에 멈춰 있지 않고 바로 이동한 것처럼 보이게 한다 */
export default function BlogLoading() {
  return (
    <main>
      <p className="notice loading">
        <span className="spinner" aria-hidden /> 불러오는 중…
      </p>
    </main>
  );
}
