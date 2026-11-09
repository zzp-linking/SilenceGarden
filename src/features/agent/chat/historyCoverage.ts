/** 服务器已完整查询过的序号区间，内部隐藏消息造成的合法间隔也属于覆盖范围。 */
export interface HistoryCoverageRange {
  fromSeq: number // 包含的下界；0表示已查询到历史起点。
  throughSeq: number // 包含的上界，仅代表已查询水位，不包含本地未提交投影。
}

/** 合并已有ranges和本次page；只连接相交或相邻区间，保留尚未补齐的断档。 */
export function extendHistoryCoverage(ranges: readonly HistoryCoverageRange[], page: HistoryCoverageRange): HistoryCoverageRange[] {
  const ordered = [...ranges, page].map(range => ({ ...range })).sort((a, b) => a.fromSeq - b.fromSeq)
  const merged: HistoryCoverageRange[] = []
  for (const range of ordered) {
    const last = merged[merged.length - 1]
    if (last && range.fromSeq <= last.throughSeq + 1) last.throughSeq = Math.max(last.throughSeq, range.throughSeq)
    else merged.push(range)
  }
  return merged
}
