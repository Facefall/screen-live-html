# 羽毛球大屏 · 页面背景与画布底色设计规范

本文档约定：**颜色数值如何定**、**CSS 如何分层与插值**、**如何与现有 HUD 切图（含 alpha PNG）对齐**。后续实现按文末「分阶段清单」逐项落地。

---

## 1. 目标与非目标

### 1.1 目标

- 页面渐变与顶栏、侧栏、页脚等 **PNG 暗部色相一致**，避免「灰补丁」「发色不对」的硬缝。
- 大面积背景 **饱和度低于** HUD 霓虹描边，不抢主画面与记分牌。
- **contain** 模式下留白区与 **cover** 模式下裁切边缘都 **柔和过渡**（外晕 + 内晕已有雏形时可在此基础上 token 化）。
- 实现 **可维护**：颜色来自 token，便于换肤或按现场显示器微调。

### 1.2 非目标

- 不在本文档阶段重做整套 UI 构图或替换切图。
- 不强制引入构建工具或 CSS 预处理器；以原生 CSS + `@supports` 为主。
- 不做高强度动画背景（若有需求另起文档）。

---

## 2. 设计原则（美术）

### 2.1 锚点：从切图暗部取样，而非手写「纯黑」

1. 在 `header-right-with-logo.png`（或合成稿 `all.png`）中取 **Logo 区域附近、非霓虹线条的暗背景** 样本 3～5 点，取平均得到 **`--sample-hud-dark`**（可先记为 sRGB，再换算 OKLCH）。
2. 同类样本可在 `footer.alpha.png` / `matche-preview.alpha.png` 边缘暗区复核；若偏差大，以 **顶栏** 为主锚（用户视线最先落于此）。

### 2.2 色相 spine（色相随）

- 所有大面积底色与光斑的色相应落在 **主锚 hue ±12°～15°** 内（例外角落若偏蓝，须 **降低 alpha**，避免跳出体系）。
- **背景的 chroma（饱和度）应低于** 记分牌/描边的霓虹层典型 chroma；靠 **亮度略降 + alpha 叠层** 做体积感，而非靠「艳紫铺屏」。

### 2.3 三层语义（逻辑分层）

| 角色 | 作用 | 实现要点 |
|------|------|-----------|
| Base wash | 整屏色相与明暗基调 | 少量 stop 的线性渐变，对比弱 |
| Key pools | 模拟「主光方位」（如左上 brand、右上 scoreboard） | 小半径径向 + **低 alpha** |
| Vignette / floor | 压四角、稳住重心 | 大椭圆径向，底部可略重 |

当前 `.badminton-page` 的多层 `radial + linear` 与此一致；规范化时需把 **每层职责写进注释**，并把颜色改为 token。

---

## 3. CSS 机制（工程）

### 3.1 插值空间：优先 OKLCH（含 LAB 思路）

- **`linear-gradient(in oklch, …)` / `radial-gradient(in oklch, …)`**：色相与亮度过渡比默认 sRGB 更干净，适合紫系深色。
- 色相跨度较大时谨慎使用 **`longer hue`** / **`shorter hue`**，避免插值走「怪异捷径」；窄色相 spine 通常 **默认插值即可**。

### 3.2 `color-mix` 与 token

- 从 `--sample-hud-dark` 衍生：
  - **`--surface-base`**：`color-mix(in oklch, var(--sample-hud-dark) 88%, black)`（比例可调）
  - **`--surface-mid`**：`color-mix(in oklch, var(--sample-hud-dark) 72%, white 3%)`（提亮极少）
- 光斑颜色宜用 **`oklch(L C H / alpha)`** 或 **`color-mix` + 透明度**，避免末端使用裸 `transparent`（在 sRGB 中等价 `rgba(0,0,0,0)`，偶发灰段）。

### 3.3 兼容策略

1. **基底**：保留一层 **sRGB** 渐变（当前已有），保证旧内核可读。
2. **增强**：`@supports (color: oklch(0 0 0))` 或 `@supports (background: linear-gradient(in oklch, red, blue))` 内覆写 **OKLCH 版** token 与 `background-image`。
3. 文档要求：**两套数值需在视觉上接近**，避免不支持 OKLCH 时落差过大。

### 3.4 与 alpha PNG、画布的关系

- **Alpha 模块**（记分牌、footer、侧栏）下方露出的必须是 **与 `--surface-*` 同色相族** 的底色，否则抠图边缘易露「染色圈」。
- **`.court-canvas`** 的底色应 **复用页面 surface token**（或 `color-mix` 衍生），与 `.badminton-page` 同源，避免「框内一套黑、框外一套黑」。
- **`.court-scaler` 的 `drop-shadow`** 叠加在页面背景之上：背景局部对比不宜过强，否则外晕边缘易显脏；token 化后应一并复核。

---

## 4. Token 清单（建议命名）

以下为建议字段；具体数值在「实现阶段」按取样填入。

| Token | 用途 |
|-------|------|
| `--sample-hud-dark` | 从切图取样的锚色（OKLCH 或 sRGB） |
| `--header-strip-edge-*` | 顶栏 PNG **四边**平均色（与羽化边缘底色对齐）；[`scripts/sample-header-edges.mjs`](../scripts/sample-header-edges.mjs) |
| `--header-strip-interior-wash` | logo 左区内饰暗底（脚本字段 `interiorLogoWash`）；配合 blend-to / mask 消矩形硬边 |
| `--surface-base` | 页面最暗基底 |
| `--surface-mid` | 中间调 |
| `--surface-deep` | 比 base 略深的踏步（可选） |
| `--glow-brand-pool` | 左上品牌侧光池（实现名；文档旧称 glow-corner-primary） |
| `--glow-scoreboard-pool` | 右上记分牌侧（旧称 glow-corner-secondary） |
| `--glow-floor-pool` | 底部氛围 |
| `--glow-edge-pool` | 右下补光 |
| `--stage-rim` / `--stage-halo-purple` / `--stage-halo-deep` / `--stage-inset-feather` | 画布 drop-shadow 与内晕；`:root` 内由 `--surface-*` 混合导出 |

---

## 5. 文件与职责

| 文件 | 职责 |
|------|------|
| [`public/badminton.css`](../public/badminton.css) | 羽毛球页背景、viewport、scaler、canvas；后续 token 与 `@supports` 主要写在此处 |
| [`docs/badminton-background-design.md`](badminton-background-design.md) | 本文档：原则与清单 |

（可选）日后若 token 增多，可拆 `public/badminton-theme.css` 由 `badminton.html` 引入；首版不必强行拆分。

---

## 6. 分阶段实现清单

按顺序执行；每一阶段完成后可在本文档对应小节打勾（或 issue 追踪）。

### 阶段 A — 取样与 token 落地

- [x] A1：从 `header-right-with-logo.png`（或 `all.png`）导出 `--sample-hud-dark`（记录 sRGB + OKLCH 两套数值）。
- [x] A2：在文档「附录」或代码注释中记下取样坐标/工具，便于日后换皮复核。
- [x] A3：定义 `--surface-base` / `--surface-mid`（及可选 `--surface-deep`）的 `color-mix` 规则。

> **顺带**：已将 `.court-canvas` 渐变接上 `--surface-*`（原「阶段 C1」的一部分提前完成）。

### 阶段 B — OKLCH 渐变与 `@supports`

- [x] B1：将 `.badminton-page` 的 `background-image` 改为使用 token 组装（sRGB 基底可先保持接近当前观感）。
- [x] B2：在 `@supports` 块内增加 `in oklch` 的 linear + radial，与 sRGB 基底视觉对齐。
- [x] B3：径向光斑位置与 HUD 视觉重心对齐（左上 ~8% 6%、右上 ~92% 14%、底部中心等），数值写进注释。

### 阶段 C — 画布与页面同源

- [x] C1：`.court-canvas` 背景改为基于 `--surface-mid` / `--surface-deep` 的渐变（或 `color-mix`），去掉与页面无关的孤立 hex。
- [x] C2：复核 `.court-viewport` 透明透出是否与 token 一致（contain 留白）。
- [x] C3：alpha PNG 边缘在典型显示器上检查一圈（footer / sidebar / scoreboard）。（步骤见 §9 附录 C；发行前目测。）

### 阶段 D — 外晕与内晕微调

- [x] D1：将 `--stage-halo-*`、`--stage-inset-feather` 与 `--glow-*` 亮度联动（避免整体过闷或过曝）。
- [x] D2：`?qa=1` 叠 `all.png` 做一次对齐目测；必要时只调 alpha 与半径，不改 HUD 切图。（流程见 §9 附录 C。）

### 阶段 E — 文档与收尾

- [x] E1：把最终 token 表附录到本文档（§10）。
- [x] E2：在 `badminton.html` 顶部注释或 README 片段中注明「主题 token 见 `docs/badminton-background-design.md`」。

---

## 7. 附录 A：阶段 A 实测锚色（header-right-with-logo.png）

| 项 | 数值 |
|----|------|
| 源文件 | `public/assets/header-right-with-logo.png` |
| 工具 | `npm run sample-hud-dark` → [`scripts/sample-hud-dark.mjs`](../scripts/sample-hud-dark.mjs) |
| 算法概要 | 步长 `STEP=6`；仅统计 `max(R,G,B)∈[8,72]` 且 `alpha≥200` 的像素（弱化霓虹/logo 高光），约 **280257** 点参与平均 |
| **sRGB** | `rgb(21, 3, 39)` |
| **Hex** | `#150327` |
| **OKLCH**（ culori 换算，供复核 / Phase B） | `oklch(0.164 0.0728 303.07)`（L / C / H） |

**衍生 token（当前 `color-mix` 均在 `srgb` 空间，便于兼容）**

| Token | 规则 |
|-------|------|
| `--surface-base` | `var(--sample-hud-dark)` |
| `--surface-mid` | `color-mix(in srgb, var(--sample-hud-dark) 93%, white)` |
| `--surface-deep` | `color-mix(in srgb, var(--sample-hud-dark) 88%, black)` |

落地文件：[`public/badminton.css`](../public/badminton.css) 内 `:root`（主题变量）、`body.badminton-page`（渐变）、`.court-canvas`。

---

## 8. 附录 B：OKLCH（阶段 B 已落地）

实现见 [`public/badminton.css`](../public/badminton.css)：`@supports (background: linear-gradient(in oklch, #150327, #000000))` 内覆写 `--surface-*`、`--glow-*`，并用 `ellipse … at … in oklch` + `linear-gradient(171deg in oklch, …)`；径向末端为锚色零 alpha `--glow-fade`，避免 `transparent` 灰段。画布 `.court-canvas` 同步 `172deg in oklch`。

```css
/* 摘录：OKLCH 覆写在 :root，渐变仍在 body.badminton-page */
@supports (background: linear-gradient(in oklch, #150327, #000000)) {
  :root {
    --surface-deep: color-mix(in oklch, var(--sample-hud-dark) 88%, black);
    --surface-mid: color-mix(in oklch, var(--sample-hud-dark) 93%, white);
    --glow-fade: oklch(0.164 0.0728 303 / 0);
    /* …光池 oklch(L C H / α)；background-image 见 .badminton-page … */
  }
}
```

---

## 9. 附录 C：阶段 C3 / D2 目测清单（发行前执行）

| 步骤 | 说明 |
|------|------|
| **C2** | **contain**：拉窄窗口直至上下或左右留白；留白区应为 **html `background-color: var(--surface-deep)`** 叠 **body** 渐变，不得露浏览器默认灰白。 |
| **C3** | **alpha PNG**：记分牌 / 侧栏 / 页脚外轮廓扫一圈，有无灰环、杂色边；优先调 `npm run knock-alpha` 或 `--stage-*`，不改 HUD 构图。 |
| **D2** | **`?qa=1`**：半透 `all.png` 校对布局；必要时只调 CSS（缩放、fit）或 knock，不换切片。 |

---

## 10. 附录 D：当前落地 token 一览（`public/badminton.css` `:root`）

| Token | 角色 |
|-------|------|
| `--sample-hud-dark` | 锚色 `#150327` |
| `--surface-base` / `--surface-mid` / `--surface-deep` | 页面与画布基底（sRGB `color-mix`；OKLCH 路径由 `@supports` 覆写 `:root`） |
| `--glow-brand-pool` / `--glow-scoreboard-pool` / `--glow-floor-pool` / `--glow-edge-pool` | 背景四层径向光池 |
| `--glow-fade` | 仅 OKLCH 路径：径向末端零 alpha（锚色 hue） |
| `--stage-rim` / `--stage-halo-purple` / `--stage-halo-deep` | `.court-scaler` 的 `drop-shadow` |
| `--stage-inset-feather` | `.court-canvas` 内晕 |
| `--header-strip-edge-top` 等（四条） | 顶栏 PNG **四边**取样；`npm run sample-header-edges` |
| `--header-strip-interior-wash` | logo 左侧内饰暗区（输出字段 `interiorLogoWash`） |
| `--header-strip-blend-to` / `--header-strip-feather-*` | 边缘渐变收口与顶栏图 **mask 羽化**（消矩形硬边） |

实现：`.court-head__strip::before` 多层底色；`.court-asset--header` 四边 `mask-composite: intersect`。

画布尺寸与布局：`--canvas-w`、`--canvas-h`、`--sidebar-w`、`--scoreboard-w`、`--fit` 等仍在 `:root`。

---

## 11. 修订记录

| 日期 | 说明 |
|------|------|
| （首版） | 确立原则、机制与分阶段清单 |
| 阶段 A 完成 | 取样 `#150327`，落地 `--surface-*`，`court-canvas` 同源渐变；新增 `sample-hud-dark` 脚本 |
| 阶段 B 完成 | `--glow-*` token、`8%/6%`·`92%/14%` 径向锚点、OKLCH 渐变与 `color-mix(in oklch)` |
| 阶段 C–E 收尾 | `:root` 主题变量、html 底色（C2）、附录 C/D；`--stage-*` 跟 surface（D1）；`badminton.html` 指向本文档（E2） |
| 顶栏四边融底 | `--header-strip-edge-*` + `.court-head__strip::before`；`npm run sample-header-edges` |
| 顶栏消「盒子边」 | `interiorLogoWash`、`--header-strip-blend-to`、PNG 四边 mask 羽化 |
