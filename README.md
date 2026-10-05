# OpenRoad

在网页里选择车型，在同一座海港城市中第一人称驾驶。无需账号、API 密钥、AI 图片服务或 CDN。

当前可用车型：Toyota Celica GT-Four（TC6）、经典 Mini 1.3（MI）、Mazda 3 2.3（3S）。包含社区制作的独立车身和座舱、可旋转三维车库、车身配色、第一人称环顾、键盘/触屏驾驶、自动换挡、倒挡、刹车、巡航、位置地图、碰撞停车和引擎音效。

## 启动

安装 Node.js 22 或更新版本，在本目录运行：

```sh
npm start
```

打开 http://localhost:4173/ 。无依赖需要安装。点击「开始驾驶」直接进入；资源加载失败会显示错误和重试入口。

运行检查：`npm test`。

网站全部位于 `public/`，可以直接由静态服务器托管。所有引用使用相对地址，也可放在 GitHub Pages 的仓库子路径。`.github/workflows/pages.yml` 已准备好：仓库创建后在 Settings → Pages 选择 GitHub Actions，推送 main 可部署。不会将 `.env`、用户图片或原型生成结果包含在发布目录里。

## 操作

- W / ↑：油门；S / ↓：刹车；A、D / ←、→：转向；空格：手刹。
- R：停稳后在前进和倒挡之间切换；也可点 R / N / D 按钮。
- 拖动：环顾；Q / E：看左右；C：回正。
- Esc / P：暂停。切换窗口自动暂停。
- 35 km/h 巡航只控制车速，需自己转向，刹车会取消。
- 设置提供画质、视野、坐姿高度和音量；移动端显示方向与踏板按钮。

## 实现和真实性范围

渲染使用本地 Three.js r180。车型、贴图、声音与原始 .car 配置来自 FirstDrive/VDrift。三辆车使用独立的质量、扭矩曲线、齿比、主减速比、轴距、转向角和轮胎尺寸；模拟以 120 Hz 固定步长运行。

这版是可以玩的驾驶原型，并未覆盖世界上大部分车型。模型较旧，Mini 和 Mazda 3 的座舱尤其简化；Celica 和 Mini 在原模型空白仪表位置增加了自制功能仪表（不是原厂仪表艺术图）；Mazda 3 的原始仪表未动态化，实时速度和转速显示在屏幕仪表中；方向盘使用资源库的共用模型；后视镜尚无实时反射。画面不是摄影级扫描。社区参数不是原厂认证数据，车辆名称仅用于标识模型。

物理为平面道路单轨近似，包括扭矩、自动挡、驱动力限制、空气阻力、滚动阻力和制动。它不包含完整悬挂、轮胎侧偏/滑移、形变碰撞或 VDrift 的完整物理求解。城市为固定程序生成地图，含道路、街区、商店、树木、静态停车、灯杆、交通灯与海岸；没有动态交通、行人或红绿灯执法。碰撞停止而不模拟损坏。

要扩展到高精度大量车型，需逐辆获得允许网站分发的模型（独立座舱、仪表、方向盘、玻璃和车轮），记录授权并核对厂商规格。不要给通用车壳改名称冒充另一款车。

## 扩展车型

当前 JOE 管线：在 `public/vehicles/cars/<ID>/` 放置 .car、模型、贴图和作者/许可文件，在 `public/driving/catalog.js` 注册车辆信息与适配坐姿。配置解析和车辆动力位于 `catalog.js` / `physics.js`；模型加载位于 `joe.js`；固定城市位于 `city.js`。增加车型必须更新归属与许可，再验证车身、座舱、贴图方向、尺寸、视角、轮胎与物理参数。

## 开源参考与许可

- [FirstDrive 数据](https://github.com/fd-firstdrive/firstdrive-data)：实际随网站分发的车辆资源和配置，GPL-3.0。
- [VDrift](https://github.com/VDrift/vdrift)：JOE 格式、车辆数据与模拟设计参考。
- [Sketchbook](https://github.com/swift502/Sketchbook)：浏览器操控、转向平滑与第一人称交互参考，未分发其代码。
- [Three.js](https://github.com/mrdoob/three.js)：渲染，MIT。

本项目按 GPL-3.0-only 发布；第三方文件保留各自许可。完整作者署名和适配说明见 `public/CREDITS.txt`。代码与原始车辆资源一并提供，包含 `public/vehicles/LICENSE` 与 `public/vendor/THREE-LICENSE.txt`。
