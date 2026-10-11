import Button from "@/components/Button";
import Card from "@/components/Card";
import { formatJapaneseDate, type ContractView } from "@/lib/schools";

const PRICE_TEXT = "年額50,000円（税込）／一括払い";

type BadgeProps = {
  className: string;
  children: React.ReactNode;
};

function Badge({ className, children }: BadgeProps) {
  return (
    <span className={`inline-block rounded-md px-sm py-xs text-sm font-bold ${className}`}>
      {children}
    </span>
  );
}

// 申込・更新の処理（Stripe Checkout）は #68。それまでは押せない状態で表示だけする
function ApplyButton({ label }: { label: string }) {
  return (
    <div className="mt-md">
      <Button disabled>{label}</Button>
      <p className="mt-xs text-center text-sm text-gray-500">準備中です</p>
    </div>
  );
}

type StatusCardProps = {
  contract: ContractView;
};

// 画面設計 UI-A03 のカード①。契約状態によって、同じ場所の表示を切り替える
export default function StatusCard({ contract }: StatusCardProps) {
  return (
    <Card>
      <h2 className="text-sm text-gray-600">📄 ご利用状況</h2>
      <div className="mt-sm">
        {contract.status === "trial" && (
          <>
            <Badge className="bg-brand/10 text-navy">無料体験中</Badge>
            <p className="mt-sm text-2xl font-bold text-navy">あと {contract.daysLeft} 日</p>
            <p className="mt-xs text-sm text-gray-600">
              無料体験終了日：{formatJapaneseDate(contract.trialEndsAt)}
            </p>
            <p className="mt-sm text-sm text-gray-600">{PRICE_TEXT}</p>
            <ApplyButton label="有料プランに申し込む →" />
          </>
        )}

        {contract.status === "trial_expired" && (
          <>
            <Badge className="bg-amber-100 text-amber-900">
              <span aria-hidden="true">⚠ </span>無料体験は終了しました
            </Badge>
            <p className="mt-sm text-sm text-gray-600">{PRICE_TEXT}</p>
            <ApplyButton label="有料プランに申し込む →" />
          </>
        )}

        {contract.status === "active" && (
          <>
            <Badge className="bg-green-100 text-green-900">
              <span aria-hidden="true">🟢 </span>契約中
            </Badge>
            <p className="mt-sm text-base text-navy">現在、有料プランをご利用中です。</p>
            <p className="mt-xs text-sm text-gray-600">
              契約有効期限：{formatJapaneseDate(contract.activeEndsAt)}
            </p>
          </>
        )}

        {contract.status === "contract_expired" && (
          <>
            <Badge className="bg-amber-100 text-amber-900">
              <span aria-hidden="true">⚠ </span>契約の有効期限が切れました
            </Badge>
            <p className="mt-sm text-sm text-gray-600">{PRICE_TEXT}</p>
            <ApplyButton label="契約を更新する →" />
          </>
        )}
      </div>
    </Card>
  );
}
