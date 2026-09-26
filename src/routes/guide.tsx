import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/rental/shell";
import { GhostButton, PrimaryButton } from "@/components/rental/ui";
import { t } from "@/lib/rental/i18n";
import { useRental } from "@/lib/rental/store";
import type { RentalData } from "@/lib/rental/types";

export const Route = createFileRoute("/guide")({ component: GuidePage });

const notes = {
  zh: [
    {
      h: "按金",
      p: "私人住宅常見為兩個月租金，法例沒有劃一上限，以租約寫明為準。新增租約時，本應用預設按金為兩個月。",
    },
    {
      h: "釐印",
      p: "租約一般須於簽立後 30 日內到稅務局加蓋印花。未打釐印，日後追討時未必能直接作為證據。租約卡上可標示已打釐印。",
    },
    {
      h: "差餉、地租、管理費",
      p: "在物業備註寫明由誰支付。口頭約定最容易爭拗，帳簿留低比事後追憶可靠。",
    },
    {
      h: "交租紀錄",
      p: "轉數快、PayMe、銀行轉帳都要留下參考編號。逾期會在總覽和收款頁標出。",
    },
    {
      h: "續約與遷出",
      p: "總覽會列出 60 日內完結的租約。通知期以契約為準，常見一個月，不要假設。",
    },
  ],
  en: [
    {
      h: "Deposit",
      p: "Two months’ rent is common for private flats. There is no single statutory cap — the tenancy controls. New leases here default the deposit to two months.",
    },
    {
      h: "Stamp duty",
      p: "A tenancy is normally stamped at the Inland Revenue Department within 30 days of signing. An unstamped agreement can be hard to rely on in court. Mark each lease once it is stamped.",
    },
    {
      h: "Rates, government rent, management fees",
      p: "Write down who pays. Verbal splits are where arguments start.",
    },
    {
      h: "Rent records",
      p: "Keep the FPS, PayMe or bank reference. Overdue rows show on Home and Rent.",
    },
    {
      h: "Renewal and move-out",
      p: "Home lists leases ending within 60 days. Notice periods follow the contract — often one month, never assume.",
    },
  ],
};

function GuidePage() {
  const lang = useRental((s) => s.lang);
  const resetDemo = useRental((s) => s.resetDemo);
  const importData = useRental((s) => s.importData);
  const snapshot = useRental((s) => ({
    properties: s.properties,
    tenants: s.tenants,
    tenancies: s.tenancies,
    payments: s.payments,
    tickets: s.tickets,
  }));
  const [msg, setMsg] = useState("");

  function exportJson() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "easyrental-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as RentalData;
        if (!Array.isArray(data.properties) || !Array.isArray(data.tenancies)) {
          setMsg(t(lang, "importBad"));
          return;
        }
        importData(data);
        setMsg(t(lang, "imported"));
      } catch {
        setMsg(t(lang, "importBad"));
      }
    };
    reader.readAsText(file);
  }

  return (
    <Shell>
      <h1 className="font-display text-4xl text-ink">{t(lang, "guideTitle")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t(lang, "disclaimer")}</p>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        {t(lang, "downloadTenancyTemplateHint")}{" "}
        <a
          className="font-semibold text-brass underline-offset-2 hover:underline"
          href="/tenancy-template-blank.pdf"
          download="easyrentalhk-tenancy-template-blank.pdf"
        >
          {t(lang, "downloadTenancyTemplate")}
        </a>
      </p>
      <ol className="mt-6 flex flex-col gap-3">
        {notes[lang].map((item, i) => (
          <li key={item.h} className="rounded-card border border-line bg-card p-4">
            <p className="text-xs text-brass">0{i + 1}</p>
            <h2 className="font-display mt-1 text-2xl text-ink">{item.h}</h2>
            <p className="mt-2 text-sm leading-relaxed">{item.p}</p>
          </li>
        ))}
      </ol>
      <section className="mt-8 rounded-card border border-line bg-card p-4">
        <h2 className="font-display text-2xl text-ink">{t(lang, "backup")}</h2>
        <p className="mt-1 text-sm text-muted">{t(lang, "homeIntro")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton onClick={exportJson}>{t(lang, "exportJson")}</PrimaryButton>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-sm font-medium">
            {t(lang, "importJson")}
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = "";
              }}
            />
          </label>
          <GhostButton
            onClick={() => {
              resetDemo();
              setMsg("");
            }}
          >
            {t(lang, "reset")}
          </GhostButton>
        </div>
        {msg && <p className="mt-3 text-sm text-brass">{msg}</p>}
      </section>
    </Shell>
  );
}
