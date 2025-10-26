# Password Verification Implementation

## Overview

Implemented bcrypt-based password verification functionality, allowing users to verify their identity and join the corresponding agent group by entering plaintext passwords.

## Core Principles

### bcrypt Working Mechanism
- **Each hash is different**: `bcrypt.hash("password")` generates a different hash each time (due to random salt)
- **Verification mechanism**: Use `bcrypt.compare(plaintext, hash)` to verify if the password matches a hash
- **One-way function**: Cannot reverse-engineer plaintext password from hash

### Implementation Flow

```
1. User inputs plaintext password (e.g.: ModSecure2024!)
                ↓
2. Fetch group_config array from /api/health
   [{name: "moderators", password_hash: "$2b$12$p7CBrw9k..."}, ...]
                ↓
3. Call findMatchingGroup(password, group_config)
   - Iterate through each group's password_hash
   - Use verifyPassword(password, hash) to verify
   - Find matching group
                ↓
4. Return match result
   {success: true, groupName: "moderators", passwordHash: "$2b$12$p7CBrw9k..."}
                ↓
5. Send matching passwordHash to backend for registration
```

## File Modifications

### 1. `studio/src/utils/passwordHash.ts`

Added the following content:

- **GroupConfig Interface**: Defines group configuration structure
  ```typescript
  interface GroupConfig {
    name: string;
    description?: string;
    password_hash?: string;
    agent_count?: number;
    metadata?: Record<string, any>;
  }
  ```

- **PasswordMatchResult Interface**: Defines verification result structure
  ```typescript
  interface PasswordMatchResult {
    success: boolean;
    groupName?: string;
    passwordHash?: string;
    error?: string;
  }
  ```

- **findMatchingGroup() Function**: Core verification logic
  ```typescript
  async function findMatchingGroup(
    password: string,
    groupConfigs: GroupConfig[]
  ): Promise<PasswordMatchResult>
  ```

  Functionality:
  - Receives user-input plaintext password
  - Iterates through all group configurations
  - Uses `verifyPassword()` to verify password
  - Returns matching group and corresponding hash

### 2. `studio/src/pages/AgentSetupPage.tsx`

Modifications:

- **Import Dependencies**:
  ```typescript
  import { findMatchingGroup, GroupConfig } from "@/utils/passwordHash";
  import { useOpenAgents } from "@/context/OpenAgentsProvider";
  ```

- **State Management**:
  ```typescript
  const { connector } = useOpenAgents();
  const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([]);
  ```

- **Fetch group_config**:
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

- **Password Verification Logic**:
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

Modifications:

- **Interface Update**:
  ```typescript
  interface PasswordModalProps {
    onConfirm: (password: string) => Promise<string | null>; // Async verification
  }
  ```

- **State Management**:
  ```typescript
  const [isVerifying, setIsVerifying] = useState(false);
  ```

- **Async Verification**:
  ```typescript
  const handleConfirm = async () => {
    setIsVerifying(true);
    const errorMessage = await onConfirm(password);
    if (errorMessage) {
      setError(errorMessage); // Display error
    }
    setIsVerifying(false);
  };
  ```

- **UI Improvements**:
  - Added loading state ("Verifying...")
  - Disabled button during verification
  - Display verification error messages

## Testing

Created unit test file `studio/src/utils/__tests__/passwordHash.test.ts`:

Test coverage:
- ✅ Verify correct password
- ✅ Reject incorrect password
- ✅ Handle empty password
- ✅ Handle empty group configuration
- ✅ Skip groups without password_hash
- ✅ Verify passwords for multiple different groups

## Usage

### Test Passwords

According to `examples/workspace_test.yaml` configuration, the following passwords can be used:

| Group        | Password              | Hash                                                          |
|--------------|-----------------------|---------------------------------------------------------------|
| moderators   | `ModSecure2024!`      | `$2b$12$p7CBrw9kLCB8LC0snzyFOeIAXSzrEK6Zw.IBXp9GYVtb75k5F/o7O` |
| ai-bots      | `AiBotKey2024!`       | `$2b$12$fN4XSArA6AmrXOZ6wtoKeO5vmUHuCUUzhFXEGulT2.GCi7VaPD2em` |
| researchers  | `ResearchAccess2024!` | `$2b$12$U2x0T4obqhhTCVRvdnQxUu0deCEsOTC3kKf.BJr3kCqgN9hD3C1QK` |
| users        | `UserStandard2024!`   | `$2b$12$Mkk6zsut18qVjGNIUkDPjuswDtUqjaW/arJumrVTEcVmpA3gJhh/i` |

### Run Tests

```bash
cd studio
npm run typecheck  # Type checking
npm test           # Run unit tests (if test framework is configured)
```

## Security

- ✅ Plaintext passwords are not stored
- ✅ Passwords only exist temporarily in memory
- ✅ Use bcrypt for secure verification
- ✅ Support guest mode (passwordless connection)
- ✅ Provide friendly error messages on verification failure

## API Response Structure

The `group_config` structure returned by the `/api/health` endpoint:

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

## FAQ

### Q: Why does hashing the same password always produce different results?
A: bcrypt uses random salt, so each hash is different. However, `bcrypt.compare()` can correctly verify the password.

### Q: How to generate a new password hash?
A: Using Python:
```python
from openagents.utils.password_utils import hash_password
hash_value = hash_password("your_password")
```

Or using TypeScript:
```typescript
import { hashPassword } from '@/utils/passwordHash';
const hash = await hashPassword("your_password");
```

### Q: What happens if password verification fails?
A: The system will display the error message "Invalid password. Please check your credentials.", and the user can re-enter or choose guest mode.

## Future Improvements

Possible enhancements:
- [ ] Add password strength validation
- [ ] Support password reset functionality
- [ ] Add login attempt limiting
- [ ] Remember last used group
- [ ] Add two-factor authentication (2FA)


## Important Fix Records

### 2025-10-17: Fixed OpenAgentsProvider Error

**Problem**: `AgentSetupPage` used the `useOpenAgents` hook, but the page was set with `requiresLayout: false` in the route, not wrapped by `OpenAgentsProvider`, causing a runtime error:
```
ERROR: useOpenAgents must be used within an OpenAgentsProvider
```

**Cause**:
- `AgentSetupPage` is a setup phase page, rendered when the user has not yet connected to the network
- `OpenAgentsProvider` is only initialized in `RootLayout`, and requires both `selectedNetwork` and `agentName` to exist
- Setup pages should not depend on a connected OpenAgents context

**Solution**:
Use `networkFetch` to directly call the `/api/health` API, instead of using `connector.getNetworkHealth()`

**Modifications** (AgentSetupPage.tsx:53-83):
```typescript
// ❌ Before (incorrect):
import { useOpenAgents } from "@/context/OpenAgentsProvider";
const { connector } = useOpenAgents();
const healthData = await connector.getNetworkHealth();

// ✅ After (correct):
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

**Testing**:
- ✅ TypeScript type checking passed
- ✅ No longer depends on OpenAgentsProvider
- ✅ Can fetch group configuration during setup phase
