# 2FA

输入 2FA 密钥，在浏览器本地生成 TOTP 动态验证码的开源工具。

在线使用：[forensax-2fa.vercel.app](https://forensax-2fa.vercel.app)

源代码：[Forensax/2FA](https://github.com/Forensax/2FA)

## 功能

- 支持 Base32 密钥和 `otpauth://totp/` 链接。
- 默认 SHA-1、6 位验证码、30 秒周期。
- 支持 SHA-256 / SHA-512、8 位验证码及 1–300 秒周期。
- 自动刷新、倒计时、复制验证码、密钥显隐与一键清空。
- 从链接自动读取算法、位数、周期、发行方和账号标签。
- 中文界面，适配电脑和手机。

## 隐私设计

验证码通过浏览器 Web Crypto API 计算，无后端、无第三方运行依赖、无分析脚本。密钥仅留在当前页面内存中，不使用 localStorage、sessionStorage、Cookie 或 URL 保存密钥。密钥默认隐藏，清空、刷新或关闭页面后需重新输入。密码管理器的忽略标记属于提示，浏览器扩展仍可自行决定行为。

CSP 禁止脚本向网络发起连接，并限制脚本来源为本站。部署服务会收到加载网页所需的普通 HTTP 请求，但应用不会在请求中加入密钥或验证码。剪贴板只在用户点击复制时写入验证码，之后由操作系统管理。

任何能访问密钥的人都能生成验证码。请仅在可信设备使用，不要将真实密钥提交到仓库。页面的演示按钮使用公开测试密钥，不能用于真实账号。工具依赖设备时间；验证码不匹配时请启用系统自动校时。仅支持时间型 TOTP，不支持 HOTP、Steam 自定义验证码或推送验证。

## 本地使用

需要 Node.js 20 或更新版本；无需安装依赖。

```sh
npm test
npm run build
python -m http.server 8080 --directory dist
```

访问 `http://localhost:8080`。Web Crypto 和剪贴板 API 需要安全上下文；生产环境使用 HTTPS，localhost 可以用于开发。

## 部署到 Vercel

导入此仓库，框架选择 **Other**，构建命令 `npm run build`，输出目录 `dist`。配置已写入 `vercel.json`。无需环境变量或服务端密钥。

## 测试

`npm test` 验证 RFC 6238 中三种算法的全部 18 个测试向量，并覆盖 Base32 校验、6 位前导零、周期边界、链接解析与无效参数，以及模拟 DOM 下的复制、刷新、清空和异步过期结果处理。测试使用 RFC 的公开示例密钥。

算法依据：[RFC 6238（含勘误）](https://www.rfc-editor.org/rfc/inline-errata/rfc6238.html)；密钥链接格式：[Google Authenticator Key URI Format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format)。

## 许可证

MIT
