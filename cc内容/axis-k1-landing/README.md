# AXIS K1 工业控制手柄宣传站

工业机械控制手柄落地页（起重机 / 挖掘机 / 农机 / 港口 / 高空作业 / 矿用 / 军工等重型设备场景），不是游戏手柄。

> **凭据存放说明**：服务器 SSH 私钥路径、1Panel 面板账号密码等敏感信息**不在本仓库**。它们保存在 Claude Code 的 auto-memory（`~/.claude/projects/.../memory/axis-vm-server.md`）。本仓库为公开 GitHub 仓库，请勿将凭据提交进来。

## 文件

| 文件 | 用途 |
|---|---|
| `index.html` | 双版本预览页（A=APEX 浅色 / B=FORGE 深色，含切换器和 localStorage 记忆），仅作设计阶段对比参考 |
| `prod.html` | **生产版本**，仅 FORGE，部署时上传这个 |

## 设计方向（已定稿：FORGE 深色重型工业）

- 背景 `#0A0B0D`，accent 安全橙 `#FF5C00`，备用黄 `#FFD83A`
- 字体：Geist + Geist Mono + Noto Sans SC（Bricolage Grotesque 已加载备用）
- 全站固定 80px 蓝图 grid 背景 + sticky 玻璃态导航
- 已弃用 APEX 浅色苹果风（仍保留在 `index.html` 内供回看，不要再回滚到这条线）

后续迭代要贴合 FORGE 的视觉语言：暗 grid、橙色高亮、Geist Mono 标签、blueprint 风线稿、`P · 0X` / `APP / 0X` / `M · 0X` 风格的工程编号。

## 当前 `prod.html` 结构（7 节锚点导航）

1. **Hero `#f-overview`** — 双语主标题、5 个产品标签、blueprint 视觉舱（左右各 4 个数据格 + 中央 SVG 线稿）
2. **Stats Strip** — 4 个里程碑数字（20yr+ / 1,200+ units / 12 markets / 5M cycles）
3. **Lineup `#f-lineup`** — 6 款产品矩阵（K1 旗舰 / KM-3 紧凑 / HJ-G81 多轴 / HJ-G42 指尖 / SL-205 装载机 / AX-A1 高空）
4. **Specs `#f-specs`** — 8 项规格栅格（IP67 / 5M cycles / ±0.1% / 125°C / 10yr / 12-24V / CAN 2.0B / SIL 2）
5. **Comparison Strip** — 橙色对比条（3.2× 寿命、0.8ms 响应）
6. **Anatomy `#f-anatomy`** — 5 个结构解析行 + blueprint 视觉
7. **Applications `#f-apps`** — 8 个应用场景（起重 / 挖机 / 港口 / 农林 / 高空 / 矿用 / 路面 / 军工）
8. **News `#f-news`** — 4 条行业资讯（CERT / LAUNCH / INSIGHT / PRODUCT 标签）
9. **Contact `#f-contact`** — 联系信息卡 + 询价表单（提交按钮目前是纯前端假提交，未接后端）
10. **CTA `#f-deploy`** — 三按钮（报价 / CAD 下载 / 预约演示）
11. **Footer** — 4 列链接 + 三地办公地址

附加：右下角浮动按钮组（回顶 / Email / Tel）、顶部中英切换（`localStorage` 记忆，key=`axis-lang`）。

## 产品资料状态：**完全占位**

- 品牌名 `AXIS`、所有型号（`K1` / `KM-3` / `HJ-G81` / `HJ-G42` / `SL-205` / `AX-A1`）是设计阶段编的占位
- 所有参数（IP67 / 5M cycles / ±0.1% / 125°C / 10yr / CAN 2.0B / SIL 2 / 0.8ms 等）都是占位
- 联系方式占位：邮箱 `sales@axis.example`、电话 `+86 755 0000 0000`、地址 `深圳 / 斯图加特 / 底特律`
- 数字占位：20yr+ / 1,200+ units / 12 markets、TÜV Rheinland 认证、EN 13309/12895、IEC 61000-6-2
- 新闻 4 条、应用 8 项的细分名称（塔吊 / 岸桥 / 收割机 / Genie / 矿山卡车 …）都是虚构

下次拿到真实资料时，**直接替换全部产品名 / 型号 / 参数 / 联系方式 / 新闻 / 案例数字 / 合规认证**，不要把虚构内容当锚点保留。用户没提供的项就问，不要继续编。

## 本地预览

```bash
cd /d/git/axis-k1-landing
python -m http.server 8088
# 浏览器打开 http://localhost:8088/index.html （双版本切换）
# 或 http://localhost:8088/prod.html （生产版）
```

## 部署到生产

服务器：Azure VM `20.24.220.197`，1Panel + OpenResty，站点根目录 `/opt/1panel/www/sites/20.24.220.197/index/index.html`。

完整 SSH / 凭据细节见 memory，命令模板：

```bash
scp -i <KEY_PATH> prod.html xkb@20.24.220.197:/tmp/index.html
ssh -i <KEY_PATH> xkb@20.24.220.197 \
  "sudo cp /tmp/index.html /opt/1panel/www/sites/20.24.220.197/index/index.html && \
   sudo chown www-data:www-data /opt/1panel/www/sites/20.24.220.197/index/index.html"
```

也可以走 1Panel Web 文件管理器上传。

公网 URL：http://20.24.220.197/

## 候选下一步

1. 替换为真实品牌 / 型号 / 参数 / 联系方式 / 新闻
2. 联系表单接后端（目前只是前端 alert 风格的假提交，未发邮件 / 未存数据库）
3. 配域名 + Let's Encrypt HTTPS
4. 加 GoAccess 或 Plausible 访问统计
5. 6 款产品拆独立详情页 / 多页结构
6. Hero blueprint 视觉舱换 3D 模型或交互动效
7. CAD / STEP / 固件下载链接接真实文件
