// 気象庁「過去の気象データ」那覇（47936）の日ごとの天気概況（昼・夜）を取得
// usage: node wx-fetch.cjs 2026 9  → {"2026-09-01": ["昼","夜"], ...}
const [y, mo] = process.argv.slice(2).map(Number);
(async () => {
  const r = await fetch(`https://www.data.jma.go.jp/stats/etrn/view/daily_s1.php?prec_no=91&block_no=47936&year=${y}&month=${mo}&day=&view=`);
  const h = await r.text(), out = {};
  const clean = s => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").replace(/\s*[\])]$/, "").trim();
  for (const m of h.matchAll(/<tr class="mtx"[^>]*>(.*?)<\/tr>/gs)) {
    const c = [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(x => clean(x[1]));
    if (!/^\d+$/.test(c[0])) continue;
    const day = c[c.length - 2], night = c[c.length - 1];
    if (!day && !night) continue;
    out[`${y}-${String(mo).padStart(2, "0")}-${c[0].padStart(2, "0")}`] = [day, night];
  }
  process.stdout.write(JSON.stringify(out));
})();
