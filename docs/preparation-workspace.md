# 备考工作区

本次在 `feat/preparation-workspace` 实现，V-Life 与 V-记各自保留同名分支。数据库迁移及服务端代码需要随前端一起发布；本地验证不会修改线上数据。

## 页面与使用流程

- `/preparation`：考试名称、日期与倒计时，桌面预览六个考试、手机三个，更多考试进入完整列表。今日待复习预览三道；每日计划、时长打卡、学习统计及固定学科入口已从备考首页移除。
- `/preparation/exams/:id`：考试自己的错题、套卷、学习资料与设置。选择“公务员套卷模板”只预填套卷分项，不产生考试分类。其他考试从空分项开始，均可添加、修改或删除分项。
- `/preparation/questions`：按题库、题型、历史红／黄题筛选；题目包含 Markdown 题干、选项、答案、解析、个人错因、知识点、目标秒数和共用材料。可保留草稿，再确认启用复习。
- `/preparation/review`：独立作答、计时、核对解析、错因标注及复习评价。自由练习只记表现，不推进排期。暂停或切到后台不累计 V-Life 作答时间。
- `/preparation/banks`：管理题库及共用材料；材料修改同步到引用它的子题。
- `/preparation/integration`：生成／撤销 V-记专用连接码。连接码仅生成时显示明文。

## 共享模型

考试关联多个题库；同一道题可以属于多个题库，并在多个考试中显示。题目仍只有一份内容和一份复习状态。单题还可直接加入某考试，或从某考试排除；排除优先。典型组织为“行测通用”“申论通用”“浙江省情”“江苏省情”，而不是为每场考试复制错题。

每份资料只有一个 material ID。每道子题引用它，但分别记录答案、错因、作答历史和复习状态。图片由内容哈希确定存储路径，同一文件复用底层对象；题干与选项通过 `asset:UUID` 引用资产。共用材料的图片应上传到材料本身，不向每道子题重复上传。

可把同类错误关联到一个“易错模式”，从该模式启动专题练习。题目可关联既有学习笔记，或将解析与错因沉淀为新笔记；笔记页面反向显示对应错题。

## 复习与双端同步

V-Life 服务端是内容版本、作答记录和 FSRS 排期的唯一写入源。`submit_attempt` 在事务内校验用户、题目内容版本、复习版本和幂等键：同一请求重试不重复写入；另一端先完成复习、题目变更或暂停后，旧作答保存为练习，不重复推进排期。

答错只能重学；答对但超过目标用时视为黄题，至多按“困难”安排。主观题由用户对照评分点自评。内容更新使用版本比较，避免覆盖另一端的新编辑。题目编辑草稿按账号和题目保留，冲突后展示最新版本，明确确认合并后才可继续保存。

V-记使用独立的“V-Life · 备考错题”卡片盒，每题投影一张原生 choice／qa 卡；关联卡片走专用复习入口，禁止落入普通卡片的独立排期。投影写入 RPC 只对服务端开放，不允许客户端伪造更高版本覆盖。V-记提交到同一 V-Life 服务，网络失败保留待确认请求并按原幂等键重试；编辑解析和错因也回写同一题目。V-Life 开窗聚焦和定时刷新排期，V-记进入复习或主动同步时更新，双方提交时始终再次校验版本。相关学习笔记可从 V-记解析区打开。

## Agent 录入约定

REST：`POST /functions/v1/agent-api/prep`，体为 `{"action":"create","input":{...}}`。MCP：`prep_guide`、`prep_list`、`prep_get`、`prep_create`、`prep_update`、`prep_batch_create`、`prep_due`、`prep_submit_attempt`、`prep_asset_upload`、`prep_asset_url`。先读取 `prep_guide`。

1. 创建考试时提供 `name` 和 `exam_date`；`template:"civil"` 为可选套卷模板。
2. 创建题库、套卷与共用材料。创建时可以指定稳定 UUID `id`；批量创建必须指定，每次最多 50 条。批量返回逐条成功／失败结果，只重试失败条目。
3. 题目先设 `status:"draft"`，再上传真实图片；文件为 PNG/JPEG/WebP，最大 10 MiB，以 `base64` 和正确 MIME 传给 `asset_upload`，同时提供且仅提供一个 `question_id`、`material_id` 或 `paper_id`。
4. 上传返回 `asset_id` 与 Markdown，原样嵌入题干、材料或选项。禁止把本地路径、仅文字描述、过期签名 URL 当作图片本体。图推选项建议 1:1 同组同画布；题干推荐 4:3 或 3:2；图表保留自然比例，不能为了比例裁掉内容。建议宽度 1200–1800 px，文字可读，移除无关截图边框。
5. 填写 `question_type`（single/multiple/judgement/text）、`options:[{key,content_md}]`、`correct_answer`（选择题 key 数组；文字题字符串）。选择题至少两个完整选项，单选恰好一个答案。判断题也录入两项明确选项。
6. 解析和个人错因分字段；只有来源明确的个人错因才写入，推测需标明“待确认”。知识点使用 `tags`；没有可靠标准用时就留空。
7. 关联 `bank_questions`、`exam_banks`、`paper_questions`；按需用 `exam_questions.mode=include/exclude`。所有关联复用题目 ID，不复制题目。
8. 更新题目／材料先 `get` 获取 revision，再 `update` 传 `expected_revision`。冲突后重新读并合并，不自动覆盖。`review_states`、`attempts`、`content_versions` 仅可读，不能自行写下次复习时间。
9. 作答提交带稳定 `idempotency_key`、题面 `content_revision`、开始时的 `expected_revision`、`answer`、`duration_seconds`、`rating`、`mode`。录入历史模考错误应使用 `mode:"practice"`；不要把 Agent 的推断当作用户已经复习。

图推完整题目结构（先将每个资产占位替换为上传所得 UUID）：

```json
{
  "entity": "questions",
  "id": "稳定题目 UUID",
  "record": {
    "stem_md": "观察下图，选择下一幅图。\n\n![题干图](asset:题干资产UUID)",
    "question_type": "single",
    "options": [
      {"key":"A","content_md":"![选项 A](asset:A图资产UUID)"},
      {"key":"B","content_md":"![选项 B](asset:B图资产UUID)"},
      {"key":"C","content_md":"![选项 C](asset:C图资产UUID)"},
      {"key":"D","content_md":"![选项 D](asset:D图资产UUID)"}
    ],
    "correct_answer":["C"],
    "explanation_md":"## 观察对象\n先检查元素数量。\n\n## 规律与排除\n写明每一步依据，以及其他选项不符合的条件。\n\n## 下次识别\n总结本题可复用的识别线索。",
    "analysis_md":"## 当时的思路\n待用户补充。\n\n## 下次提醒\n先检验简单数量规律，再判断位置变化。",
    "tags":["图形推理"],
    "status":"draft"
  }
}
```

资料分析推荐解析结构：`核心判断 → 已知与所求 → 推导步骤（LaTeX）→ 快速估算 → 易错提醒`。一段材料的五个问题录为五道题，使用同一个 `material_id`。

常识／政治理论推荐结构：`正确答案与依据 → 必背要点 → 易混辨析（表格）→ 记忆提示 → 自测问题`。依据注明来源和适用日期，不为凑模板生成无关扩展。示例：

```md
## 正确答案与依据
指出题目中的关键限制词，并引用可核验依据。

## 必背要点
- 主体：谁行使该职权。
- 条件：在什么情况下适用。
- 边界：哪些情形不能套用。

## 易混辨析
| 概念 | 适用条件 | 本题排除理由 |
| --- | --- | --- |
| 相近概念 | 写明差别 | 对应具体选项 |

## 记忆提示
用准确的条件关系概括，不用容易误导的绝对化口诀。
```

主观题推荐 `评分要点 → 参考作答 → 我的遗漏 → 改写建议`，保留原始材料和用户作答，不用机械字符串匹配判分。

## 数据迁移与发布

V-Life 顺序应用：

- `20261008085241_preparation_workspace.sql`
- `20261008092946_preparation_bridge_and_history.sql`

迁移保留旧题、考试及套卷 ID、图片、原始字段和历史排期。已掌握题迁为暂停；旧多选 `AB` 转为答案数组；旧资料留在迁移题库中，不猜测考试归属。原表不删除。旧 Agent civil 接口经过兼容层读写新表，不继续产生两套独立数据。

部署 V-Life 的 `prep-api`、`prep-bridge`、`agent-api`、`mcp-server` 及前端。前两者自行验证网页身份／专用连接码，配置 `verify_jwt=false`；CORS 使用实际站点白名单。

V-记应用 `20261008010000_preparation_bridge.sql`，部署其应用，并配置服务端 `SUPABASE_SERVICE_ROLE_KEY` 或已有等效 `SUPABASE_SECRET_KEY`；按 V-记 `docs/preparation-bridge.md` 配置私有连接存储与 V-Life 桥接地址。这些密钥不能放入 `NEXT_PUBLIC_*`。

发布后仍需真实账号双端验收：连接 → 带图题入库 → V-记复习 → V-Life 到期列表消失 → 反向编辑 → 冲突合并 → 撤销连接。当前本地验证不等于线上联调通过。

## 本地验收记录（2026-10-08）

- V-Life 全量 Vitest：95 个文件、568 项通过（`--maxWorkers=2`，避免并发导致无关订阅测试超时）。
- V-记全量 Vitest：45 个文件、184 项通过。
- 备考 Deno：9 项通过；四个 Edge Function 入口类型检查通过。
- 两端 PGlite：迁移、租户隔离、权限、CAS、共享状态、幂等重试与旧数据保留验证通过。
- 两端 TypeScript 与生产构建通过；V-Life 备考新增目录 ESLint 无错误。
- 桌面 1440px／手机 390px：考试网格、三条错题预览、共用材料、图推图片与四个选项、提交后进入下一题均做了浏览器检查。带图题无横向溢出。截图位于 `docs/preparation-preview/`。
- 浏览器仍可见应用现有的 React script-tag 提示及 Router future-flag 提示；本次未改全局脚本或路由版本。构建有现存的大 chunk 提示。
- 未执行远程数据库迁移、推送、部署或真实账号双端验收。
