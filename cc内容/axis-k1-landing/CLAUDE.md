# Project: AXIS K1 工业控制手柄宣传站

## 立即唤起的记忆

进入这个目录时，从 auto-memory 读这两条以恢复完整上下文：

- `axis-k1-landing` — 设计方向（FORGE 深色重型）、本地文件结构、产品资料占位状态、后续候选任务
- `axis-vm-server` — Azure VM SSH 凭据、1Panel + OpenResty 部署细节、站点根目录、面板地址

详细信息见 `README.md`。

## 关键约束

- **品牌 AXIS / 型号 K1 / 所有参数都是占位**。用户提供真实资料时直接替换，不要把虚构内容当锚点保留。
- **设计已定稿 FORGE 深色版**，不要回滚浅色苹果风。
- **本仓库公开**（`xchao0919/git`）。**不要把 SSH 私钥、面板密码、IP 凭据写进任何文件提交**。这些只能存 memory。
- **生产部署文件是 `prod.html`**，不是 `index.html`（后者是双版本对比预览页）。

## 常用命令

```bash
# 本地预览
python -m http.server 8088

# 部署到 20.24.220.197（凭据见 axis-vm-server memory）
scp -i <KEY_PATH> prod.html xkb@20.24.220.197:/tmp/index.html
ssh -i <KEY_PATH> xkb@20.24.220.197 \
  "sudo cp /tmp/index.html /opt/1panel/www/sites/20.24.220.197/index/index.html && \
   sudo chown www-data:www-data /opt/1panel/www/sites/20.24.220.197/index/index.html"
```
