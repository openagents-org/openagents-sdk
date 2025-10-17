# Password Verification Implementation

## 概述

实现了基于 bcrypt 的密码验证功能，允许用户通过输入明文密码来验证其身份并加入相应的 agent group。

## 核心原理

### bcrypt 工作原理
- **每次 hash 都不同**：`bcrypt.hash("password")` 每次生成的 hash 都不同（因为使用随机 salt）
- **验证机制**：使用 `bcrypt.compare(plaintext, hash)` 来验证密码是否匹配某个 hash
- **单向函数**：无法从 hash 反推明文密码

### 实现流程

```
1. 用户输入明文密码（例：ModSecure2024!）
                ↓
2. 从 /api/health 获取 group_config 数组
   [{name: "moderators", password_hash: "$2b$12$p7CBrw9k..."}, ...]
                ↓
3. 调用 findMatchingGroup(password, group_config)
   - 遍历每个 group 的 password_hash
   - 使用 verifyPassword(password, hash) 验证
   - 找到匹配的 group
                ↓
4. 返回匹配结果
   {success: true, groupName: "moderators", passwordHash: "$2b$12$p7CBrw9k..."}
                ↓
5. 将匹配的 passwordHash 发送给后端进行注册
```

## 文件修改

### 1. `studio/src/utils/passwordHash.ts`

添加了以下内容：

- **GroupConfig 接口**：定义 group 配置结构
  ```typescript
  interface GroupConfig {
    name: string;
    description?: string;
    password_hash?: string;
    agent_count?: number;
    metadata?: Record<string, any>;
  }
  ```

- **PasswordMatchResult 接口**：定义验证结果结构
  ```typescript
  interface PasswordMatchResult {
    success: boolean;
    groupName?: string;
    passwordHash?: string;
    error?: string;
  }
  ```

- **findMatchingGroup() 函数**：核心验证逻辑
  ```typescript
  async function findMatchingGroup(
    password: string,
    groupConfigs: GroupConfig[]
  ): Promise<PasswordMatchResult>
  ```
  
  功能：
  - 接收用户输入的明文密码
  - 遍历所有 group 配置
  - 使用 `verifyPassword()` 验证密码
  - 返回匹配的 group 和对应的 hash

### 2. `studio/src/pages/AgentSetupPage.tsx`

修改内容：

- **导入依赖**：
  ```typescript
  import { findMatchingGroup, GroupConfig } from "@/utils/passwordHash";
  import { useOpenAgents } from "@/context/OpenAgentsProvider";
  ```

- **状态管理**：
  ```typescript
  const { connector } = useOpenAgents();
  const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([]);
  ```

- **获取 group_config**：
  ```typescript
  useEffect(() => {
    const fetchGroupConfigs = async () => {
      if (!connector) return;
      const healthData = await connector.getNetworkHealth();
      if (healthData && healthData.group_config) {
        setGroupConfigs(healthData.group_config);
      }
    };
    fetchGroupConfigs();
  }, [connector]);
  ```

- **密码验证逻辑**：
  ```typescript
  const handlePasswordConfirm = async (password: string): Promise<string | null> => {
    const result = await findMatchingGroup(password, groupConfigs);
    
    if (result.success && result.passwordHash) {
      console.log(`Password matched group: ${result.groupName}`);
      setIsPasswordModalOpen(false);
      proceedWithConnection(result.passwordHash);
      return null; // Success
    } else {
      return result.error || "Invalid password. Please try again.";
    }
  };
  ```

### 3. `studio/src/components/auth/PasswordModal.tsx`

修改内容：

- **接口更新**：
  ```typescript
  interface PasswordModalProps {
    onConfirm: (password: string) => Promise<string | null>; // 异步验证
  }
  ```

- **状态管理**：
  ```typescript
  const [isVerifying, setIsVerifying] = useState(false);
  ```

- **异步验证**：
  ```typescript
  const handleConfirm = async () => {
    setIsVerifying(true);
    const errorMessage = await onConfirm(password);
    if (errorMessage) {
      setError(errorMessage); // 显示错误
    }
    setIsVerifying(false);
  };
  ```

- **UI 改进**：
  - 添加 loading 状态（"Verifying..."）
  - 禁用按钮在验证期间
  - 显示验证错误消息

## 测试

创建了单元测试文件 `studio/src/utils/__tests__/passwordHash.test.ts`：

测试覆盖：
- ✅ 验证正确密码
- ✅ 拒绝错误密码
- ✅ 处理空密码
- ✅ 处理空 group 配置
- ✅ 跳过没有 password_hash 的 group
- ✅ 验证多个不同 group 的密码

## 使用方法

### 测试密码

根据 `examples/workspace_test.yaml` 配置，可以使用以下密码：

| Group        | Password              | Hash                                                          |
|--------------|-----------------------|---------------------------------------------------------------|
| moderators   | `ModSecure2024!`      | `$2b$12$p7CBrw9kLCB8LC0snzyFOeIAXSzrEK6Zw.IBXp9GYVtb75k5F/o7O` |
| ai-bots      | `AiBotKey2024!`       | `$2b$12$fN4XSArA6AmrXOZ6wtoKeO5vmUHuCUUzhFXEGulT2.GCi7VaPD2em` |
| researchers  | `ResearchAccess2024!` | `$2b$12$U2x0T4obqhhTCVRvdnQxUu0deCEsOTC3kKf.BJr3kCqgN9hD3C1QK` |
| users        | `UserStandard2024!`   | `$2b$12$Mkk6zsut18qVjGNIUkDPjuswDtUqjaW/arJumrVTEcVmpA3gJhh/i` |

### 运行测试

```bash
cd studio
npm run typecheck  # 类型检查
npm test           # 运行单元测试（如果配置了测试框架）
```

## 安全性

- ✅ 明文密码不会被存储
- ✅ 密码仅在内存中临时存在
- ✅ 使用 bcrypt 进行安全验证
- ✅ 支持 guest 模式（无密码连接）
- ✅ 验证失败时提供友好错误信息

## API 响应结构

`/api/health` 端点返回的 `group_config` 结构：

```json
{
  "success": true,
  "status": "healthy",
  "data": {
    "network_id": "workspace-test-1",
    "group_config": [
      {
        "name": "moderators",
        "description": "Forum moderators with elevated permissions",
        "agent_count": 0,
        "metadata": {...},
        "password_hash": "$2b$12$p7CBrw9k..."
      },
      {
        "name": "ai-bots",
        "description": "AI assistant and automation agents",
        "agent_count": 0,
        "metadata": {...},
        "password_hash": "$2b$12$fN4XSArA6..."
      }
    ]
  }
}
```

## 常见问题

### Q: 为什么每次 hash 同一个密码结果都不同？
A: bcrypt 使用随机 salt，所以每次 hash 都不同。但是 `bcrypt.compare()` 能正确验证密码。

### Q: 如何生成新的密码 hash？
A: 使用 Python：
```python
from openagents.utils.password_utils import hash_password
hash_value = hash_password("your_password")
```

或使用 TypeScript：
```typescript
import { hashPassword } from '@/utils/passwordHash';
const hash = await hashPassword("your_password");
```

### Q: 如果密码验证失败怎么办？
A: 系统会显示错误消息 "Invalid password. Please check your credentials."，用户可以重新输入或选择 guest 模式。

## 后续改进

可能的增强功能：
- [ ] 添加密码强度验证
- [ ] 支持密码重置功能
- [ ] 添加登录尝试限制
- [ ] 记住上次使用的 group
- [ ] 添加双因素认证（2FA）


## 重要修复记录

### 2025-10-17: 修复 OpenAgentsProvider 错误

**问题**：`AgentSetupPage` 使用了 `useOpenAgents` hook，但该页面在路由中设置为 `requiresLayout: false`，不在 `OpenAgentsProvider` 包裹范围内，导致运行时错误：
```
ERROR: useOpenAgents must be used within an OpenAgentsProvider
```

**原因**：
- `AgentSetupPage` 是 setup 阶段的页面，在用户还未连接到网络时渲染
- `OpenAgentsProvider` 只在 `RootLayout` 中初始化，且需要 `selectedNetwork` 和 `agentName` 都存在
- Setup 页面不应该依赖已连接的 OpenAgents context

**解决方案**：
改用 `networkFetch` 直接调用 `/api/health` API，而不是通过 `connector.getNetworkHealth()`

**修改内容** (AgentSetupPage.tsx:53-83):
```typescript
// ❌ 之前（错误）:
import { useOpenAgents } from "@/context/OpenAgentsProvider";
const { connector } = useOpenAgents();
const healthData = await connector.getNetworkHealth();

// ✅ 修改后（正确）:
import { networkFetch } from "@/utils/httpClient";
const response = await networkFetch(
  selectedNetwork.host,
  selectedNetwork.port,
  "/api/health",
  {
    method: "GET",
    headers: { Accept: "application/json" },
  }
);
const healthData = await response.json();
const groupConfigs = healthData.data?.group_config || [];
```

**测试**：
- ✅ TypeScript 类型检查通过
- ✅ 不再依赖 OpenAgentsProvider
- ✅ 在 setup 阶段就能获取 group 配置

