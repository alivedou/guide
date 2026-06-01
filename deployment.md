🚀 从零开始：Cloudflare 全新部署上云 6 步法
第一步：登录 Wrangler CLI 工具
在您的 wsl 终端中安装并进行 Cloudflare 账户授权登录：
```bash
npm install -g wrangler
wrangler login
```
第二步：创建 D1 数据库（并配置）
1.创建 D1 实例：
```bash
wrangler d1 create cloudnav-db
```
2.记录并修改 ID：
创建成功后，控制台会输出一串 16 进制字符的 database_id。
请打开项目根目录下的 wrangler.toml，将 wrangler.toml:13 中的 database_id = "YOUR_D1_DATABASE_ID" 修改为您刚获取到的 真实 D1 ID。
第三步：创建 KV 命名空间（并配置）
1.创建 KV 实例：
```bash
wrangler kv namespace create nav
```
2.记录并修改 ID：
创建成功后，控制台会输出一串 id。
打开 wrangler.toml，将 wrangler.toml:9 中的 id = "YOUR_KV_NAMESPACE_ID" 修改为您刚获取到的 真实 KV ID。
第四步：推送 D1 数据库初始化结构
在根目录下执行该命令，Wrangler 会自动扫描 migrations 目录下的所有本地 SQL 数据表结构并灌入到您刚创建的远程 D1 数据库中：
```bash
wrangler d1 migrations apply cloudnav-db --remote
```

(中途如有提示，输入 y 确认并继续执行。)

第五步：进入核心目录并执行一键部署
1.必须要先进入 nav-main 子系统文件夹中：
```bash
cd nav-main
```
2.执行发布命令（带上英文 commit 信息绕过工具 Bug）：
```bash
wrangler pages deploy ./public --project-name=cloudnav --commit-message="Fresh CloudNav Deploy"
```
(在首次部署过程中，控制台询问是否创建新项目时，直接按下 Enter 确认，分支提问时直接回车或输入 main 即可。)
第六步：到 Cloudflare 网页端完成最后的关联绑定
1.登录 Cloudflare 官方控制台 ；
2.依次进入：Workers & Pages → cloudnav (刚创建的 Pages 项目) → Settings → Functions ；
3.KV 命名空间绑定 (KV Namespace Bindings)：
点击新增绑定，Binding name 填入 nav，并选中您刚创建的 KV 实例。
4.D1 数据库绑定 (D1 Database Bindings)：
点击新增绑定，Binding name 填入 DB，并选中您刚创建的 D1 数据库。
5.添加加密密钥环境变量：
在 Environment variables 中点击 Add variables，新增环境变量：
JWT_SECRET → cc9f09dc-e2a1-425f-91c8-45452204f432 （可以使用任意复杂密钥）
6.激活重新发布：
配置完毕后，进入 Deployments 页面点击最新一次部署后面的三点重试重新部署，或者在 wsl 终端中再次运行一次
 ```bash
 wrangler pages deploy ./public --project-name=cloudnav --commit-message="Activate Config"
 ```
 ，即可完美通关，全站极速上线运行！
