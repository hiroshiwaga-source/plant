/** 世話ログ一覧向け: 相対日付 + 時刻（日本語ロケール） */
export function formatCareWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  const now = new Date();
  const sod = (t: Date) => {
    const x = new Date(t);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const dayDiff = Math.round((sod(now) - sod(d)) / 86_400_000);
  if (dayDiff < 0) {
    return d.toLocaleString("ja-JP", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  const time = d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dayDiff === 0) return `今日 ${time}`;
  if (dayDiff === 1) return `昨日 ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff}日前 ${time}`;
  if (dayDiff >= 7 && dayDiff < 365) {
    return `${d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} ${time}`;
  }
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
