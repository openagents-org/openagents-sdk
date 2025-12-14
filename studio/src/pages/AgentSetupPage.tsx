import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getSavedAgentNameForNetwork,
  saveAgentNameForNetwork,
} from "@/utils/cookies"
import {
  generateRandomAgentName,
  isValidName,
  getAvatarInitials,
} from "@/utils/utils";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";
import { hashPassword } from "@/utils/passwordHash";
import { networkFetch } from "@/utils/httpClient";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

// Interface for group configuration from /api/health
interface GroupConfig {
  name: string
  description?: string
  has_password: boolean
  agent_count?: number
  metadata?: Record<string, any>
}

const AgentNamePicker: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const {
    selectedNetwork,
    setAgentName,
    clearAgentName,
    clearNetwork,
    setPasswordHash,
    setAgentGroup,
  } = useAuthStore()

  const [pageAgentName, setPageAgentName] = useState<string | null>(null)
  const [savedAgentName, setSavedAgentName] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)

  // Admin mode state (separate from group selection)
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false)
  const [adminPassword, setAdminPassword] = useState<string>("")
  const [passwordError, setPasswordError] = useState<string>("")

  // Group selection state
  const [availableGroups, setAvailableGroups] = useState<GroupConfig[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [defaultGroup, setDefaultGroup] = useState<string>("guest")
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true)
  const [showAdminButton, setShowAdminButton] = useState<boolean>(false)

  // Password for selected group (non-admin groups that require password)
  const [groupPassword, setGroupPassword] = useState<string>("")

  const handleRandomize = useCallback(() => {
    setPageAgentName(generateRandomAgentName())
  }, [setPageAgentName])

  // Load saved agent name
  useEffect(() => {
    if (!selectedNetwork) return
    const savedName = getSavedAgentNameForNetwork(
      selectedNetwork.host,
      selectedNetwork.port
    )

    if (savedName) {
      setSavedAgentName(savedName)
      setPageAgentName(savedName)
    } else {
      handleRandomize()
    }
  }, [selectedNetwork, handleRandomize, setPageAgentName])

  // Fetch network configuration and available groups
  useEffect(() => {
    const fetchNetworkConfig = async () => {
      if (!selectedNetwork) return

      setIsLoadingGroups(true)
      try {
        const response = await networkFetch(
          selectedNetwork.host,
          selectedNetwork.port,
          "/api/health",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            useHttps: selectedNetwork.useHttps,
          }
        )

        if (response.ok) {
          const healthData = await response.json()

          // Extract group configuration
          const groupConfig: GroupConfig[] =
            healthData.data?.group_config || []
          const defaultGroupName =
            healthData.data?.default_agent_group || "guest"

          // Check if admin group exists
          const hasAdminGroup =
            Array.isArray(groupConfig) &&
            groupConfig.some((group) => group.name === "admin")
          setShowAdminButton(hasAdminGroup)

          // Filter out admin group from available groups for dropdown
          const nonAdminGroups = groupConfig.filter(
            (group) => group.name !== "admin"
          )

          // If no non-admin groups are configured, create a default fallback group
          if (nonAdminGroups.length === 0) {
            const fallbackGroup: GroupConfig = {
              name: defaultGroupName,
              description: "Default agent group",
              has_password: false,
            }
            setAvailableGroups([fallbackGroup])
          } else {
            setAvailableGroups(nonAdminGroups)
          }

          setDefaultGroup(defaultGroupName)

          // Pre-select the default group (if it's not admin)
          const defaultToSelect =
            defaultGroupName !== "admin" ? defaultGroupName : nonAdminGroups[0]?.name || "guest"
          setSelectedGroup(defaultToSelect)

          console.log("Available groups (excluding admin):", nonAdminGroups)
          console.log("Default group:", defaultGroupName)
          console.log("Has admin group:", hasAdminGroup)
        }
      } catch (error) {
        console.error("Failed to fetch network config:", error)
        // On error, provide a default fallback group so users can still connect
        const fallbackGroupName = "guest"
        const fallbackGroup: GroupConfig = {
          name: fallbackGroupName,
          description: "Default agent group",
          has_password: false,
        }
        setAvailableGroups([fallbackGroup])
        setSelectedGroup(fallbackGroupName)
      } finally {
        setIsLoadingGroups(false)
      }
    }

    fetchNetworkConfig()
  }, [selectedNetwork])

  // Get the selected group's configuration
  const selectedGroupConfig = availableGroups.find(
    (g) => g.name === selectedGroup
  )

  // Determine if password is required based on selected group
  const selectedGroupRequiresPassword =
    selectedGroupConfig?.has_password ?? false

  const onBack = useCallback(() => {
    clearAgentName()
    clearNetwork()
  }, [clearAgentName, clearNetwork])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const agentNameTrimmed = pageAgentName?.trim()
    if (!agentNameTrimmed || !selectedNetwork) return

    // Validate password requirements
    if (isAdminMode && !adminPassword.trim()) {
      setPasswordError("Admin password is required")
      return
    }

    if (!isAdminMode && selectedGroupRequiresPassword && !groupPassword.trim()) {
      setPasswordError(`Password is required for the '${selectedGroup}' group`)
      return
    }

    setIsVerifying(true)
    setPasswordError("")

    try {
      let passwordHash: string | null = null
      let targetGroup = selectedGroup

      if (isAdminMode) {
        // Hash the password for admin group
        passwordHash = await hashPassword(adminPassword)
        targetGroup = "admin"
        console.log(`Connecting to admin group with password`)
      } else if (selectedGroupRequiresPassword && groupPassword.trim()) {
        // Hash the password for selected group
        passwordHash = await hashPassword(groupPassword)
        console.log(`Connecting to group '${selectedGroup}' with password`)
      } else {
        // No password needed for this group
        console.log(
          `Connecting to group '${selectedGroup}' (no password required)`
        )
      }

      // Verify credentials by attempting registration
      const verifyResponse = await networkFetch(
        selectedNetwork.host,
        selectedNetwork.port,
        "/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agentNameTrimmed,
            metadata: {
              display_name: agentNameTrimmed,
              platform: "web",
              verification_only: true,
            },
            password_hash: passwordHash || undefined,
            agent_group: targetGroup || undefined,
          }),
          useHttps: selectedNetwork.useHttps,
        }
      )

      const verifyData = await verifyResponse.json()

      if (!verifyData.success) {
        // Registration failed
        const errorMessage =
          verifyData.error_message || "Failed to connect to network"
        console.error("Failed to connect:", errorMessage)

        if (isAdminMode) {
          setPasswordError(
            errorMessage.includes("password") ||
              errorMessage.includes("credentials")
              ? t('agentSetup.errors.invalidAdminPassword')
              : errorMessage
          )
        } else if (selectedGroupRequiresPassword) {
          setPasswordError(
            errorMessage.includes("password") ||
              errorMessage.includes("credentials")
              ? t('agentSetup.errors.invalidPassword', { group: selectedGroup })
              : errorMessage
          )
        } else {
          setPasswordError(errorMessage)
        }

        setIsVerifying(false)
        return
      }

      // Registration succeeded - unregister to let the main app re-register
      try {
        await networkFetch(
          selectedNetwork.host,
          selectedNetwork.port,
          "/api/unregister",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              agent_id: agentNameTrimmed,
              secret: verifyData.secret,
            }),
            useHttps: selectedNetwork.useHttps,
          }
        )
      } catch (unregError) {
        // Ignore unregister errors - not critical
        console.warn("Failed to unregister after verification:", unregError)
      }

      // Proceed with connection
      proceedWithConnection(passwordHash, isAdminMode ? "admin" : targetGroup)
    } catch (error) {
      console.error("Failed to verify credentials:", error)
      if (isAdminMode) {
        setPasswordError(t('agentSetup.errors.adminConnectionFailed'))
      } else {
        setPasswordError(t('agentSetup.errors.connectionFailed'))
      }
      setIsVerifying(false)
    }
  }

  const proceedWithConnection = (
    hash: string | null,
    targetGroup: string | null
  ) => {
    const agentNameTrimmed = pageAgentName?.trim()
    if (!agentNameTrimmed || !selectedNetwork) return

    // Save the agent name for this network
    saveAgentNameForNetwork(
      selectedNetwork.host,
      selectedNetwork.port,
      agentNameTrimmed
    )

    // Store the password hash and group in authStore
    setPasswordHash(hash)
    setAgentGroup(targetGroup)
    setAgentName(agentNameTrimmed)

    // Navigate based on user type
    if (targetGroup === "admin") {
      // Admin users go directly to admin dashboard
      navigate("/admin/dashboard", { replace: true })
    } else {
      // Regular users go to root - RouteGuard will redirect to the appropriate default route
      // after modules are loaded (which determines if README or messaging is the default)
      navigate("/")
    }
  }

  const handleAdminLogin = () => {
    // Switch to admin mode - show password input
    setIsAdminMode(true)
    setPasswordError("")
    setAdminPassword("")
  }

  const handleExitAdminMode = () => {
    setIsAdminMode(false)
    setAdminPassword("")
    setPasswordError("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-indigo-400 to-purple-500 dark:from-blue-800 dark:to-violet-800">
      <div className="max-w-lg w-full text-center rounded-2xl p-10 bg-white shadow-2xl shadow-black/25 dark:bg-gray-800 dark:shadow-black/50 relative">
        {/* Header */}
        <div className="mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg border-4 border-white dark:border-gray-800">
            {getAvatarInitials(pageAgentName)}
          </div>

          <h1 className="text-3xl font-bold mb-3 text-gray-800 dark:text-gray-50">
            {t('agentSetup.title')}
          </h1>
          <p className="text-base leading-relaxed text-gray-500 dark:text-gray-300">
            {isAdminMode
              ? t('agentSetup.adminSubtitle')
              : t('agentSetup.subtitle')}
          </p>
        </div>

        {/* Network Info */}
        <div className="rounded-xl p-4 mt-4 mb-4 text-left bg-gray-100 dark:bg-gray-700">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('agentSetup.connectingTo')}
          </div>
          {selectedNetwork && (
            <div className="text-base font-semibold text-gray-800 dark:text-gray-100">
              {selectedNetwork.host}:{selectedNetwork.port}
            </div>
          )}
        </div>

        {/* Saved Agent Name Info */}
        {savedAgentName && (
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 my-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-sky-700 dark:text-sky-400">
              {t('agentSetup.previousName')}
            </div>
            <div className="text-base font-semibold text-sky-900 dark:text-sky-100">
              {savedAgentName}
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-400 mt-1">
              {t('agentSetup.previousNameHint')}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="my-4">
          {/* Agent Name Input */}
          <div className="mb-4 text-left">
            <label
              htmlFor="agentName"
              className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300"
            >
              {t('agentSetup.agentName')}
            </label>
            <input
              id="agentName"
              type="text"
              value={pageAgentName || ""}
              onChange={(e) => setPageAgentName(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg text-base transition-all duration-150 focus:outline-none focus:ring-3 bg-white border-gray-300 text-gray-800 focus:border-blue-500 focus:ring-blue-500/10 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/10"
              placeholder={t('agentSetup.agentNamePlaceholder')}
              maxLength={32}
              autoComplete="off"
            />

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleRandomize}
                className="px-3 py-2 rounded-md text-sm cursor-pointer transition-all duration-150 bg-gray-100 border border-gray-300 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-500 dark:border-gray-400 dark:text-gray-100 dark:hover:bg-gray-400 dark:hover:text-gray-800"
              >
                {t('agentSetup.buttons.randomName')}
              </button>
              {savedAgentName && pageAgentName !== savedAgentName && (
                <button
                  type="button"
                  onClick={() => setPageAgentName(savedAgentName)}
                  className="px-3 py-2 rounded-md text-sm cursor-pointer transition-all duration-150 bg-blue-500 text-white border-none hover:bg-blue-600"
                >
                  {t('agentSetup.buttons.usePrevious', { name: savedAgentName })}
                </button>
              )}
            </div>

            <div className="text-xs mt-2 leading-relaxed text-gray-500 dark:text-gray-400">
              {savedAgentName && (
                <>💾 {t('agentSetup.nameSavedHint')}</>
              )}
            </div>
          </div>

          {/* Admin Mode: Password Input */}
          {isAdminMode && (
            <>
              <div className="mb-4 text-left">
                <label
                  htmlFor="adminPassword"
                  className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300"
                >
                  {t('agentSetup.adminPassword')} <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value)
                    setPasswordError("") // Clear error when user types
                  }}
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all duration-150 focus:outline-none focus:ring-3 bg-white text-gray-800 focus:border-blue-500 focus:ring-blue-500/10 dark:bg-white dark:text-gray-800 dark:focus:border-blue-400 dark:focus:ring-blue-400/10 ${
                    passwordError
                      ? "border-red-500 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-500"
                  }`}
                  placeholder={t('agentSetup.adminPasswordPlaceholder')}
                  autoComplete="off"
                  required
                />

                {/* Password Error */}
                {passwordError && (
                  <div className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-start gap-1">
                    <span className="mt-0.5">⚠️</span>
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Password Hint */}
                <div className="text-xs mt-2 leading-relaxed text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">🔒 {t('agentSetup.adminPasswordRequired')}</span>{" "}
                  {t('agentSetup.adminPasswordHint')}
                </div>
              </div>

              {/* Exit Admin Mode Button */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleExitAdminMode}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                >
                  {t('agentSetup.backToRegularLogin')}
                </button>
              </div>
            </>
          )}

          {/* Regular Mode: Group Selection */}
          {!isAdminMode && (
            <>
              {/* Agent Group Selection */}
              <div className="mb-4 text-left">
                <label
                  htmlFor="agentGroup"
                  className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300"
                >
                  {t('agentSetup.agentGroup')}
                </label>
                {isLoadingGroups ? (
                  <div className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-500 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                    {t('agentSetup.loadingGroups')}
                  </div>
                ) : (
                  <select
                    id="agentGroup"
                    value={selectedGroup || ""}
                    onChange={(e) => {
                      setSelectedGroup(e.target.value)
                      setGroupPassword("") // Clear password when group changes
                      setPasswordError("")
                    }}
                    className="w-full px-4 py-3 border-2 rounded-lg text-base transition-all duration-150 focus:outline-none focus:ring-3 bg-white border-gray-300 text-gray-800 focus:border-blue-500 focus:ring-blue-500/10 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/10"
                  >
                    {availableGroups.map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.has_password ? "🔒 " : ""}
                        {group.name}
                        {group.name === defaultGroup ? ` (${t('agentSetup.default')})` : ""}
                      </option>
                    ))}
                  </select>
                )}

                {/* Group Description */}
                {selectedGroupConfig && (
                  <div className="text-xs mt-2 leading-relaxed text-gray-500 dark:text-gray-400">
                    ℹ️{" "}
                    {selectedGroupConfig.description || t('agentSetup.groupDescription', { group: selectedGroup })}
                  </div>
                )}
              </div>

              {/* Password Input - Only show if selected group requires password */}
              {selectedGroupRequiresPassword && (
                <div className="mb-4 text-left">
                  <label
                    htmlFor="groupPassword"
                    className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300"
                  >
                    {t('agentSetup.password')} <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    id="groupPassword"
                    type="password"
                    value={groupPassword}
                    onChange={(e) => {
                      setGroupPassword(e.target.value)
                      setPasswordError("") // Clear error when user types
                    }}
                    className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-all duration-150 focus:outline-none focus:ring-3 bg-white text-gray-800 focus:border-blue-500 focus:ring-blue-500/10 dark:bg-gray-600 dark:text-gray-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/10 ${
                      passwordError
                        ? "border-red-500 dark:border-red-400"
                        : "border-gray-300 dark:border-gray-500"
                    }`}
                    placeholder={t('agentSetup.passwordPlaceholder', { group: selectedGroup })}
                    autoComplete="off"
                  />

                  {/* Password Error */}
                  {passwordError && (
                    <div className="text-red-500 dark:text-red-400 text-sm mt-2 flex items-start gap-1">
                      <span className="mt-0.5">⚠️</span>
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {/* Password Hint */}
                  <div className="text-xs mt-2 leading-relaxed text-gray-500 dark:text-gray-400">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      🔒 {t('agentSetup.passwordRequired')}
                    </span>{" "}
                    {t('agentSetup.passwordRequiredHint', { group: selectedGroup })}
                  </div>
                </div>
              )}

              {/* No password required notice */}
              {!selectedGroupRequiresPassword && selectedGroup && !passwordError && (
                <div className="mb-4 text-left">
                  <div className="text-xs leading-relaxed text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    ✓ {t('agentSetup.noPasswordRequired', { group: selectedGroup })}
                  </div>
                </div>
              )}

              {/* Error display for non-password errors */}
              {passwordError && !selectedGroupRequiresPassword && (
                <div className="mb-4 text-left">
                  <div className="text-red-500 dark:text-red-400 text-sm flex items-start gap-1">
                    <span className="mt-0.5">⚠️</span>
                    <span>{passwordError}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onBack}
              disabled={isVerifying}
              className="flex-1 py-3 border rounded-lg text-base font-semibold cursor-pointer transition-all duration-150 bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-gray-500 dark:hover:text-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('agentSetup.buttons.back')}
            </button>
            <button
              type="submit"
              disabled={
                !isValidName(pageAgentName) ||
                isVerifying ||
                isLoadingGroups ||
                (isAdminMode && !adminPassword.trim()) ||
                (!isAdminMode && selectedGroupRequiresPassword && !groupPassword.trim())
              }
              className={`flex-[2] px-6 py-3 border-none rounded-lg text-base font-semibold cursor-pointer transition-all duration-150 text-white ${
                !isValidName(pageAgentName) ||
                isVerifying ||
                isLoadingGroups ||
                (isAdminMode && !adminPassword.trim()) ||
                (!isAdminMode && selectedGroupRequiresPassword && !groupPassword.trim())
                  ? "bg-gray-300 dark:bg-gray-500 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30"
              }`}
            >
              <div className="flex flex-wrap justify-center items-center gap-2">
                {isVerifying ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>{t('agentSetup.buttons.connecting')}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {isAdminMode
                        ? t('agentSetup.buttons.loginAsAdmin')
                        : t('agentSetup.buttons.connect', { name: pageAgentName || "Agent" })}
                    </span>
                    <span>→</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </form>

        {/* Admin Login Button - Only show if admin group exists and not in admin mode */}
        {showAdminButton && !isLoadingGroups && !isAdminMode && (
          <>
            <div className="mt-6 mb-4 flex items-center">
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
              <span className="px-4 text-sm text-gray-500 dark:text-gray-400">
                {t('agentSetup.or')}
              </span>
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <button
              type="button"
              onClick={handleAdminLogin}
              disabled={isVerifying || !isValidName(pageAgentName)}
              className="w-full px-6 py-3 border-2 border-blue-500 bg-transparent text-blue-600 dark:text-blue-400 rounded-lg text-base font-semibold cursor-pointer transition-all duration-150 hover:bg-blue-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('agentSetup.buttons.loginAsAdmin')}
            </button>
          </>
        )}
        <div className="flex justify-end mt-4">
          {/* Language Switcher - Bottom right of card, outside form */}
          <LanguageSwitcher showFlag={true} showFullName={false} variant="minimal" align="right" size="md" />
        </div>
      </div>
    </div>
  )
}

export default AgentNamePicker
