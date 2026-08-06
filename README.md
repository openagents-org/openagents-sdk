<div align="center">

# OpenAgents Network SDK

**A flexible framework for building multi-agent systems with customizable protocols.**

[![PyPI](https://img.shields.io/pypi/v/openagents.svg)](https://pypi.org/project/openagents/)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

</div>

This repository holds the **`openagents` Python SDK** — the agent-network core,
transports (gRPC / WebSocket / HTTP / A2A / MCP), mods, adapters, and the CLI.
It was extracted from the [`openagents`](https://github.com/openagents-org/openagents)
monorepo so the SDK can be versioned, tested, and published on its own. Full
commit history is preserved.

## Install

```bash
pip install openagents            # core
pip install "openagents[sdk]"     # + gRPC, crypto, MCP server, LLM providers
pip install "openagents[all]"     # everything (see pyproject.toml extras)
```

From source:

```bash
git clone https://github.com/openagents-org/openagents-network-sdk
cd openagents-network-sdk
pip install -e ".[sdk]"
```

## Layout

| Path | Contents |
|------|----------|
| `src/openagents/` | the `openagents` package (published to PyPI) |
| `src/openagents/core/` | network core: `network.py`, `topology.py`, transports, connectors |
| `src/openagents/mods/` | protocol mods (messaging, coordination, discovery, workspace…) |
| `src/openagents/adapters/` | coding-agent adapters (claude, codex, cursor, aider, …) |
| `examples/` | runnable example networks and agents |
| `demos/` | end-to-end demos |
| `studio/` | Studio frontend (not actively maintained) |

## CLI

```bash
openagents --help
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
