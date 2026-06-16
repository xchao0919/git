# AXIS K1 工业控制手柄宣传站

工业机械控制手柄落地页（起重机 / 挖掘机 / 农机 / 远程控制等重型设备场景），不是游戏手柄。

> **凭据存放说明**：服务器 SSH 私钥路径、1Panel 面板账号密码等敏感信息**不在本仓库**。它们保存在 Claude Code 的 auto-memory（`~/.claude/projects/.../memory/axis-vm-server.md`）。本仓库为公开 GitHub 仓库，请勿将凭据提交进来。

## 文件

| 文件 | 用途 |
|---|---|
| `index.html` | 双版本预览页（A=APEX 浅色 / B=FORGE 深色，含切换器和 localStorage 记忆），仅作设计阶段对比参考 |
| `prod.html` | **生产版本**，仅 FORGE，部署时上传这个 |

## 设计方向（已定稿：FORGE 深色重型工业）

- 背景 `#0A0B0D`，accent 安全橙 `#FF5C00`
- 字体：Geist + Geist Mono + Noto Sans SC
- 板块：Hero / blueprint 视觉舱 / 8 项 spec 栅格 / 对比条 / Anatomy / 4 个应用场景 / CTA / Footer
- 已弃用 APEX 浅色苹果风（仍保留在 `index.html` 内供回看，不要再回滚到这条线）

后续迭代要贴合 FORGE 的视觉语言：暗 grid、橙色高亮、Geist Mono 标签、blueprint 风线稿。

## 产品资料状态：**完全占位**

- 品牌名 `AXIS`、型号 `K1` 是设计阶段编的占位
- 所有参数（IP67 / 5M cycles / ±0.1% / 10yr 寿命 / CAN 2.0B 等）都是占位
- 应用场景、deploy 数字（1,200+ 单位、12 国）也是虚构

下次拿到真实资料时，**直接替换全部产品名 / 型号 / 参数 / 案例数字 / 合规认证**，不要把虚构内容当锚点保留。用户没提供的项就问，不要继续编。

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

1. 替换为真实产品图 / 型号 / 参数
2. 配域名 + Let's Encrypt HTTPS
3. 加 GoAccess 访问统计
4. 拆产品详情页 / 多页结构
5. 头部加 3D 模型或交互动效
