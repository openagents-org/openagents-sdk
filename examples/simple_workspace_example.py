import asyncio
from openagents.core.client import AgentClient


async def main():
    client = AgentClient(agent_id="charlie")
    await client.connect("localhost", 8570)
    ws = client.workspace()

    channels = await ws.channels()
    print(f"Channels: {channels}")

    agents = await ws.agents()
    print(f"Agents online: {agents}")

    await ws.channel("general").post("Hello from Charlie!")


if __name__ == "__main__":
    asyncio.run(main())