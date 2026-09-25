import Button from "../../components/Button";
import Card from "../../components/Card";
import Input from "../../components/Input";
import PageShell from "../../components/PageShell";

export default function DesignSamplePage() {
  return (
    <PageShell>
      <h1 className="mb-lg text-2xl font-bold text-navy">
        しごとみっけ
      </h1>

      <Card>
        <div className="space-y-md">
          <h2 className="text-xl font-semibold text-navy">
            共通コンポーネント
          </h2>

          <Input
            label="ニックネーム"
            placeholder="ニックネームを入力"
          />

          <Button>次へ</Button>
        </div>
      </Card>
    </PageShell>
  );
}