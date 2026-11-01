# seed-data

職業まわりのマスタデータ（職業グループ・職業・学問領域）を、ここに JSON として置いています。
`pnpm prisma db seed` が、この JSON を読んで DB に投入します。

**「正」とする元データは、Googleスプレッドシート（shigoto_mikke_data_prep）です。**
スプレッドシートを直したら、この JSON も同じ内容に直してください（食い違いを防ぐため、
職業の追加・変更は、スプレッドシートと JSON の両方を同じ PR・同じ時期に更新します）。

DB設計.md §7・§9 の通り、`interests` / `traits` / `questions` / `question_options`
は確定値なので `prisma/seed.ts` に直接ハードコードしています。

以下の3つは、すべて中身が入っています（件数はチェック用の目安）。

- `job-groups.json` — job_groups（8件想定）
- `jobs.json` — jobs（39件想定。job_interests / job_traits / job_academic_fields もこのファイルの
  `interestCodes` / `traitCodes` / `academicFieldNames` から自動的に投入されます）
- `academic-fields.json` — academic_fields（22件想定）

## フォーマット

データを追加・変更するときは、以下の形式で書いてください（`prisma/seed.ts` がこの形をそのまま読みます）。

```jsonc
// job-groups.json
[{ "id": 1, "name": "IT・データ・先端技術", "sortOrder": 1 }]
```

```jsonc
// academic-fields.json
[
  {
    "name": "情報学",
    "category": "science", // "liberal_arts" | "science" | "mixed"
    "representativeTopics": "プログラミング,アルゴリズム",
    "sortOrder": 1,
  },
]
```

```jsonc
// jobs.json
[
  {
    "id": 7,
    "jobGroupId": 1,
    "name": "ゲームプランナー",
    "summary": "ゲームの企画やルールを考える仕事", // 未定なら description の先頭から自動生成
    "description": "仕事内容の全文……",
    "imageUrl": null, // "/images/jobs/job-7.webp" 等。未定なら null（emoji 代替）
    "emoji": "🎮",
    "interestCodes": ["game", "it"], // interests.code（DB設計.md §6.2 参照）
    "traitCodes": ["ideate"], // traits.code（同上）
    "academicFieldNames": ["情報学"], // academic_fields.name
  },
]
```

`interestCodes` / `traitCodes` / `academicFieldNames` に、DB設計.md §6.4 の検証ルール
（12種／5種／academic_fields に存在する名称、以外はNG）に反する値が入っていると
seed 実行時にエラーで止まります（意図的な挙動）。
