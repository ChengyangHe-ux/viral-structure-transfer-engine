# MCP服务器和Skills配置指南

## 推荐的MCP服务器配置

### 1. 文件系统访问（必需）
用于读取和管理项目文件

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/hechengyang/比赛/字节跳动工程系列活动"
      ]
    }
  }
}
```

### 2. Git操作（推荐）
用于版本控制和代码管理

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "/Users/hechengyang/比赛/字节跳动工程系列活动"
      ]
    }
  }
}
```

### 3. 网络搜索（可选）
用于查找设计灵感和技术文档

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 4. 数据库访问（推荐）
用于直接查询和管理SQLite数据库

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sqlite",
        "--db-path",
        "/Users/hechengyang/比赛/字节跳动工程系列活动/dev.db"
      ]
    }
  }
}
```

### 5. Playwright自动化（可选）
用于自动化测试和截图

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": [
        "/Users/hechengyang/比赛/字节跳动工程系列活动/.playwright-mcp/build/index.js"
      ]
    }
  }
}
```

---

## 完整配置文件

创建或更新 `~/.claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/hechengyang/比赛/字节跳动工程系列活动"
      ]
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "/Users/hechengyang/比赛/字节跳动工程系列活动"
      ]
    },
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sqlite",
        "--db-path",
        "/Users/hechengyang/比赛/字节跳动工程系列活动/dev.db"
      ]
    }
  }
}
```

---

## 推荐的Skills配置

### 1. 视频质量检查Skill

创建 `.claude/skills/video-quality-check.md`：

```markdown
---
name: video-quality-check
description: 检查生成的视频质量，包括分辨率、帧率、时长、音频等
---

# 视频质量检查

## 使用方法
```bash
npm run video:check -- --input <video-path>
```

## 检查项
- 分辨率：1080x1920（竖屏）
- 帧率：30fps
- 音频：存在且可播放
- 时长：合理范围内
- 码率：足够高

## 输出
JSON格式的质量报告
```

### 2. 案例生成Skill

创建 `.claude/skills/generate-demo-case.md`：

```markdown
---
name: generate-demo-case
description: 生成演示案例，用于测试和展示
---

# 生成演示案例

## 使用方法
```bash
npm run cases:generate
```

## 功能
- 生成多个预设场景的案例
- 包含完整的样例分析和迁移方案
- 自动保存到 cases/generated/

## 输出
- JSON格式的案例文件
- Markdown格式的可读版本
```

### 3. 冠军验收Skill

创建 `.claude/skills/champion-check.md`：

```markdown
---
name: champion-check
description: 按照比赛评分标准检查项目完成度
---

# 冠军验收

## 使用方法
```bash
npm run champion:check
```

## 检查内容
- 基础闭环完成度（25分）
- 素材缺口处理（20分）
- 结果展示（20分）
- 进阶能力（20分）
- 人机协同（15分）
- 加分项（10分）

## 输出
- 总分和各项得分
- 未达标项目的改进建议
- 冠军就绪状态
```

---

## 配置步骤

### Step 1: 安装MCP服务器

```bash
# 文件系统服务器（通常已内置）
npx -y @modelcontextprotocol/server-filesystem --help

# Git服务器
npx -y @modelcontextprotocol/server-git --help

# SQLite服务器
npx -y @modelcontextprotocol/server-sqlite --help
```

### Step 2: 创建配置文件

```bash
# 创建配置目录
mkdir -p ~/.claude

# 创建配置文件
cat > ~/.claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/hechengyang/比赛/字节跳动工程系列活动"
      ]
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "/Users/hechengyang/比赛/字节跳动工程系列活动"
      ]
    },
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sqlite",
        "--db-path",
        "/Users/hechengyang/比赛/字节跳动工程系列活动/dev.db"
      ]
    }
  }
}
EOF
```

### Step 3: 重启Claude Code

```bash
# 如果使用CLI
# 退出当前会话，重新启动即可

# 如果使用桌面版
# 完全退出应用，重新打开
```

### Step 4: 验证配置

在Claude Code中运行：

```
请列出当前可用的MCP服务器
```

应该看到：
- filesystem
- git
- sqlite

---

## 使用示例

### 1. 使用文件系统MCP

```
请读取 src/app/page.tsx 文件的前50行
```

### 2. 使用Git MCP

```
请查看最近5次的git提交记录
```

### 3. 使用SQLite MCP

```
请查询数据库中所有项目的列表
```

---

## 高级配置

### 1. 添加环境变量

```json
{
  "mcpServers": {
    "custom-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "your-key",
        "DEBUG": "true"
      }
    }
  }
}
```

### 2. 使用本地脚本

```json
{
  "mcpServers": {
    "project-helper": {
      "command": "node",
      "args": [
        "/Users/hechengyang/比赛/字节跳动工程系列活动/scripts/mcp-helper.js"
      ]
    }
  }
}
```

### 3. 配置超时和重试

```json
{
  "mcpServers": {
    "slow-server": {
      "command": "npx",
      "args": ["slow-mcp-server"],
      "timeout": 30000,
      "retries": 3
    }
  }
}
```

---

## 故障排查

### 问题1: MCP服务器无法启动

**症状**: 提示"MCP server failed to start"

**解决方案**:
1. 检查命令路径是否正确
2. 确保npx可用：`which npx`
3. 手动测试命令：`npx -y @modelcontextprotocol/server-filesystem --help`
4. 查看日志：`~/.claude/logs/`

### 问题2: 权限错误

**症状**: "Permission denied"

**解决方案**:
```bash
# 给予执行权限
chmod +x /path/to/script

# 或使用sudo（不推荐）
sudo npx ...
```

### 问题3: 路径不存在

**症状**: "Path not found"

**解决方案**:
```bash
# 使用绝对路径
pwd  # 获取当前目录的绝对路径

# 更新配置文件中的路径
```

---

## 性能优化

### 1. 缓存MCP服务器

```bash
# 预先安装，避免每次启动时下载
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-git
npm install -g @modelcontextprotocol/server-sqlite
```

### 2. 使用本地服务器

对于频繁使用的功能，考虑创建本地MCP服务器：

```javascript
// scripts/mcp-helper.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'project-helper',
  version: '1.0.0',
});

// 添加自定义工具
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'check-video-quality',
      description: '检查视频质量',
      inputSchema: {
        type: 'object',
        properties: {
          videoPath: { type: 'string' }
        }
      }
    }
  ]
}));

// 启动服务器
server.connect();
```

---

## 安全建议

### 1. 限制文件系统访问

只授予必要的目录访问权限：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/hechengyang/比赛/字节跳动工程系列活动",
        "--read-only"
      ]
    }
  }
}
```

### 2. 不要在配置中存储敏感信息

使用环境变量：

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["api-mcp-server"],
      "env": {
        "API_KEY": "${API_KEY}"  // 从系统环境变量读取
      }
    }
  }
}
```

### 3. 定期更新MCP服务器

```bash
# 更新所有MCP服务器
npm update -g @modelcontextprotocol/server-*
```

---

## 总结

配置完成后，你将拥有：

✅ **文件系统访问** - 快速读写项目文件
✅ **Git集成** - 版本控制和代码管理
✅ **数据库访问** - 直接查询和管理数据
✅ **自定义Skills** - 项目特定的快捷命令

这将大大提升开发效率！🚀
