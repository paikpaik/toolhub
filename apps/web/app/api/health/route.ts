/** MCP의 open_web이 포트에 떠 있는 것이 toolhub 웹인지, 어느 커밋인지 확인할 때 쓴다 */
export function GET() {
  return Response.json({ app: "toolhub", commit: process.env.TOOLHUB_COMMIT ?? null });
}
