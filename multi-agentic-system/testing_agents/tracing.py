from __future__ import annotations

import sys
import threading
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

try:
    from colorama import Fore, Style, init
except ImportError:  # pragma: no cover
    class _ColorFallback:
        BLACK = ""
        BLUE = ""
        CYAN = ""
        GREEN = ""
        MAGENTA = ""
        RED = ""
        WHITE = ""
        YELLOW = ""
        RESET_ALL = ""
        BRIGHT = ""

    Fore = Style = _ColorFallback()

    def init(*args, **kwargs) -> None:
        return None

init(autoreset=True)


@dataclass(slots=True)
class AgentPanel:
    name: str
    status: str = "pending"
    detail: str = ""
    tool_line: str = ""


@dataclass(slots=True)
class ConsoleTracer:
    enabled: bool = True
    live_mode: bool = field(default_factory=lambda: sys.stdout.isatty())
    supervisor_line: str = ""
    panels: dict[str, AgentPanel] = field(default_factory=dict)
    panel_order: list[str] = field(default_factory=list)
    current_agent: ContextVar[str | None] = field(default_factory=lambda: ContextVar("current_agent", default=None))
    render_lock: threading.RLock = field(default_factory=threading.RLock)

    def supervisor(self, message: str) -> None:
        if not self.enabled:
            return
        with self.render_lock:
            self.supervisor_line = f"{Fore.MAGENTA}{Style.BRIGHT}Supervisor{Style.RESET_ALL}: {message}"
            self._render_or_print(self.supervisor_line)

    def agent_start(self, agent_name: str, message: str) -> None:
        if not self.enabled:
            return
        with self.render_lock:
            panel = self._get_panel(agent_name)
            panel.status = "running"
            panel.detail = message
            panel.tool_line = ""
            self.current_agent.set(agent_name)
            self._render_or_print(f"{Fore.CYAN}{Style.BRIGHT}{agent_name}{Style.RESET_ALL}: {message}")

    def agent_done(self, agent_name: str, message: str) -> None:
        if not self.enabled:
            return
        with self.render_lock:
            panel = self._get_panel(agent_name)
            panel.status = "done"
            panel.detail = message
            panel.tool_line = ""
            if self.current_agent.get() == agent_name:
                self.current_agent.set(None)
            self._render_or_print(f"{Fore.CYAN}{agent_name}{Style.RESET_ALL}: {message}")

    def tool(self, tool_name: str, target: str, status: str) -> None:
        if not self.enabled:
            return
        with self.render_lock:
            agent_name = self.current_agent.get()
            if self.live_mode and agent_name:
                panel = self._get_panel(agent_name)
                panel.tool_line = f"{tool_name}: {target} -> {status}"
                self._render_dashboard()
                return
            print(f"{Fore.YELLOW}[TOOL]{Style.RESET_ALL} {tool_name}: {target} -> {status}")

    def llm_call(self, role: str, model: str, message: str) -> None:
        if not self.enabled:
            return
        with self.render_lock:
            agent_name = self.current_agent.get()
            if self.live_mode and agent_name:
                panel = self._get_panel(agent_name)
                panel.tool_line = f"LLM {role}: {model} | {message}"
                self._render_dashboard()
                return
            print(f"{Fore.BLUE}{Style.BRIGHT}[LLM {role}]{Style.RESET_ALL} {model} | {message}")

    def _get_panel(self, agent_name: str) -> AgentPanel:
        panel = self.panels.get(agent_name)
        if panel is None:
            panel = AgentPanel(name=agent_name)
            self.panels[agent_name] = panel
            self.panel_order.append(agent_name)
        return panel

    def _render_or_print(self, fallback_line: str) -> None:
        if self.live_mode:
            self._render_dashboard()
            return
        print(fallback_line)

    def _render_dashboard(self) -> None:
        lines: list[str] = []
        if self.supervisor_line:
            lines.append(self.supervisor_line)
        for agent_name in self.panel_order:
            panel = self.panels[agent_name]
            status_color = (
                Fore.CYAN + Style.BRIGHT
                if panel.status == "running"
                else Fore.GREEN
                if panel.status == "done"
                else Fore.WHITE
            )
            status_text = f"{status_color}{panel.status.upper()}{Style.RESET_ALL}"
            lines.append(f"{status_text} {Style.BRIGHT}{panel.name}{Style.RESET_ALL}")
            lines.append(f"  {panel.detail}")
            tool_text = panel.tool_line or "idle"
            lines.append(f"  {Fore.YELLOW}> {Style.RESET_ALL}{tool_text}")
            lines.append("")

        output = "\x1b[2J\x1b[H" + "\n".join(lines)
        print(output, end="", flush=True)


def summarize_output(payload: Any, limit: int = 160) -> str:
    text = str(payload).replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "..."
