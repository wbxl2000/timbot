# RTCube

RTCube 是展现 TencentCloud RTC 场景下多产品能力的示例工程，包括 Chat 等产品的示例代码。既可以快速体验 RTC 场景下多产品能力，也可以作为 RTC 场景下多产品能力接入的参考。

## 🚀 推荐：使用更高效的 AI 集成助手
我们为您提供了全新的 AI 集成方式，如果您不需要完整的 Demo 工程, 只想快速开始集成，推荐您使用更高效的 AI 集成助手，只需要简单描述您的需求，即可自动生成集成代码，大幅提升开发效率。</br>
[点击这里，立即体验 AI 集成](https://cloud.tencent.com/document/product/269/124481)

## 目录结构

RTCube 目前包含三个页面：

- `src/pages/Home`: 首页，产品简介并提供各个场景的入口。
- `src/pages/stages`: 舞台页，用于展示 RTCube 的各个场景，目前包含 Chat 场景。
- `src/pages/login`: 登录页，用于登录 RTCube，目前支持通过输入 UserID\SDKAppID\SecretKey 登录。
- `src/scenes/Chat`: 聊天场景，用于展示 Chat 产品，也是 Chat Demo 代码的入口。

## 快速开始

1. 安装依赖并跑通项目

  ```bash
  git clone https://github.com/Tencent-RTC/TUIKit_Vue3.git
  cd ./demos/web-vite-vue3
  npm i
  npm run dev
  ```

2. 创建腾讯云即时通讯IM应用


  登录[即时通信 IM 控制台](https://console.cloud.tencent.com/im)，创建新应用（如果没有）。

  ![创建新应用](https://qcloudimg.tencent-cloud.cn/image/document/d3f4ffc645958a2175c7e3446a5704ab.png)

3. 获取 SDKAppID 和 SecretKey

  在应用管理页面的 SDKAppID 列获取 SDKAppID 信息。

  ![获取 SDKAppID](https://qcloudimg.tencent-cloud.cn/image/document/df612dd991adfe652a791dae5f113fbd.png)

  在应用管理页面的密钥列获取 SecretKey 信息。

  ![获取 SecretKey](https://qcloudimg.tencent-cloud.cn/image/document/4069a2d18a878491b4a63fccd266ec9b.png)

4. 创建用户并获取 userID

可单击 即时通信 IM 控制台 > 账号管理，切换至目标应用所在账号，创建 2 个 userID 方便后续体验聊天功能。

  ![创建用户](https://qcloudimg.tencent-cloud.cn/image/document/09ed4e322fa8128992c8cc6a16337bab.png)

5. 在登录页填入 SDKAppID、userID、SecretKey，并点击登录。
