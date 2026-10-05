# 彼境 · Scene Companion

上传人物全身图与场景图，一键提交真实 3D 重建，在生成世界中与人物交互。

**当前状态：接入代码已实现；未配置付费 API 密钥，真实照片端到端重建尚未验证。缺少服务时不会展示占位模型。**

## 使用者流程

打开网站 → 上传两张图片 → 填写人物名字（性格可选）→ 开始模拟 → 等待生成 → 进入世界。

访问者不用安装工具或填写 API 密钥。服务由网站运营者统一配置。

## 实现结构

- 场景图 → World Labs Marble → 本地下载 Gaussian splat → Three.js / Spark 渲染。
- 人物图 → Meshy 图生 3D（带纹理、A-pose）→ 骨骼绑定 → 从服务商目录选择待机/走路/挥手 → 合并动画 GLB → AnimationMixer。
- 真实资源全部准备好后才进入 3D 场景。不提供方块、人物贴片或照片贴墙的替代模拟。
- WASD 自由移动、拖动视角、Q/E 升降、手机方向键、动画状态切换、人物跟随。
- 服务端兼容 Chat Completions 的角色对话，可选视觉模型输入；未配置 AI 时返回明确错误，不伪造模型回复。
- 浏览器朗读、截图、虚拟礼物事件、对话上下文、IndexedDB 存档和记忆导出。
- 持久化生成任务 ID、刷新后恢复、已生成资产复用、上传大小检查、服务端密钥隔离。

## 运营者运行

Node.js 22.9+，无 npm 安装依赖：

```sh
cp .env.example .env
npm start
```

打开 http://localhost:4173。通过服务器 `.env` 配置：

| 配置 | 作用 |
| --- | --- |
| WORLD_LABS_API_KEY | 场景照片重建 |
| MESHY_API_KEY | 人物重建、骨骼绑定、动作生成 |
| CHAT_BASE_URL / CHAT_MODEL / CHAT_API_KEY | 角色对话 |
| CHAT_VISION=true | 可选，模型必须支持图片输入 |

不要提交 `.env`、真实图片、任务数据或密钥。数据文件位于被忽略的 `data/`。

浏览器按需加载 Three.js 0.180.0 与 Spark 2.3.1 官方 CDN，需要网络和 WebGL2。首页无需这些依赖即可上传、查看生成状态。

## 验证

`npm test`：移动控制、消息校验、接口行为、跨站检查、私密文件隔离、人物生成阶段恢复、并发去重、动作选择与资产缓存。生成管线测试使用模拟服务响应，不代表真实生成质量通过验收。

## 真实感边界与待完成工作

- 单张照片的未见区域由生成模型推测，人物面部、服装与环境不能保证精确复原。建议清晰全身图，四肢无遮挡。
- 当前自由移动是 fly-through，尚无碰撞网格、导航网格、避障跟随和脚底地形贴合。
- 人物和场景原点自动叠合，真实样本验证后需补充位置、尺度和光照校准；不保证首次生成就能自然融合。
- 送礼和探索为事件与对话，尚未生成递物动画；无口型同步、面部表情与实时语音。
- 缺少真实服务密钥，World Labs / Meshy / 对话模型的端到端行为及生成质量未实测。
- 生成阶段提交响应不确定时停止自动重提，避免重复计费，需运营者核查服务商控制台。
- 当前为单用户本地服务。公网发布前还需用户会话隔离、认证、配额/费用限制、队列与对象存储。不能把带付费密钥的开发服务直接暴露公网。
- Sites 注册已创建但未发布。当前不发布静态占位体验。

## 参考

- [image-blaster](https://github.com/neilsonnn/image-blaster)：静态场景与动态对象分离，World Labs 资源流程。未复制原仓库源码。
- [Meshy Image to 3D](https://docs.meshy.ai/en/api/image-to-3d)、[Rigging](https://docs.meshy.ai/en/api/rigging)、[Animation](https://docs.meshy.ai/en/api/animation)：人物重建与动画。
- [Spark](https://sparkjs.dev/docs/)：真实 Gaussian splat 与 mesh 混合渲染。
- [Spline](https://spline.design/solutions/ai-3d-generation)、[Marble](https://marble.worldlabs.ai/)：直接创作入口与世界预览的设计参考。

首页场景图是 AI 生成的视觉概念图，明确标注为非重建结果。
