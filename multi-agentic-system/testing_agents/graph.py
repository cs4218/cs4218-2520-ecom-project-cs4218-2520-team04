from __future__ import annotations

from .agents import AgentRuntime
from .state import GraphState


def _langgraph_import():
    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError as exc:
        raise RuntimeError(
            "LangGraph is not installed. Run `uv sync` inside multi-agentic-system before using the CLI."
        ) from exc
    return START, END, StateGraph


def build_analyze_graph(runtime: AgentRuntime):
    START, END, StateGraph = _langgraph_import()
    graph = StateGraph(GraphState)

    def repo_cartographer(state: GraphState) -> GraphState:
        runtime.tracer.supervisor("Calling subagent RepoCartographerAgent")
        repo_map = runtime.build_repo_map()
        runtime.artifacts.write_json("repo_map.json", repo_map.to_dict())
        return {"repo_map": repo_map}

    def inventory_agent(state: GraphState) -> GraphState:
        runtime.tracer.supervisor("Calling subagent TestInventoryAgent")
        inventory = runtime.build_test_inventory(state["repo_map"])
        runtime.artifacts.write_json("test_inventory.json", inventory.to_dict())
        return {"test_inventory": inventory}

    def analyze_agent(state: GraphState) -> GraphState:
        runtime.tracer.supervisor("Calling subagents BackendGapAnalystAgent, FrontendGapAnalystAgent, GapTriagerAgent")
        gap_plan = runtime.analyze_gaps(state["repo_map"], state["test_inventory"])
        runtime.artifacts.write_json("gap_plan.json", [item.to_dict() for item in gap_plan])
        return {"gap_plan": gap_plan}

    graph.add_node("repo_cartographer", repo_cartographer)
    graph.add_node("test_inventory", inventory_agent)
    graph.add_node("analyze", analyze_agent)
    graph.add_edge(START, "repo_cartographer")
    graph.add_edge("repo_cartographer", "test_inventory")
    graph.add_edge("test_inventory", "analyze")
    graph.add_edge("analyze", END)
    return graph.compile()


def build_write_graph(runtime: AgentRuntime):
    START, END, StateGraph = _langgraph_import()
    graph = StateGraph(GraphState)

    def writer_agent(state: GraphState) -> GraphState:
        attempt = state.get("retry_count", 0) + 1
        runtime.tracer.supervisor("Calling subagents TestDesignAgent and TestWriterAgent")
        write_results = runtime.write_fix_batch(
            state.get("active_items", []),
            failure_feedback=state.get("failure_feedback", {}),
            attempt=attempt,
        )
        return {"write_results": write_results, "retry_count": attempt}

    def verification_agent(state: GraphState) -> GraphState:
        runtime.tracer.supervisor("Calling subagent VerificationAgent")
        verified_results, failed_gap_ids, failure_feedback = runtime.verify_fix_batch(
            state.get("active_items", []),
            state.get("write_results", []),
        )
        completed = list(state.get("completed_results", []))
        active_items = state.get("active_items", [])
        if failed_gap_ids and state.get("retry_count", 0) < runtime.config.write_retry_limit and not runtime.config.dry_run:
            completed.extend([item for item in verified_results if item.gap_id not in failed_gap_ids])
            next_active = [item for item in active_items if item.gap_id in failed_gap_ids]
            return {
                "completed_results": completed,
                "active_items": next_active,
                "failed_gap_ids": failed_gap_ids,
                "failure_feedback": failure_feedback,
            }

        completed.extend(verified_results)
        return {
            "completed_results": completed,
            "active_items": [],
            "failed_gap_ids": [],
            "failure_feedback": {},
        }

    def repair_agent(state: GraphState) -> GraphState:
        runtime.tracer.supervisor("Calling subagent RepairAgent")
        repaired_feedback = runtime.repair_failed_fixes(
            state.get("active_items", []),
            state.get("failure_feedback", {}),
            state.get("retry_count", 0),
        )
        return {"failure_feedback": repaired_feedback}

    def finalize_agent(state: GraphState) -> GraphState:
        write_results = state.get("completed_results", [])
        runtime.artifacts.write_json("write_report.json", [item.to_dict() for item in write_results])
        return {"write_results": write_results}

    def route_after_verify(state: GraphState) -> str:
        if state.get("active_items"):
            return "repair"
        return "finalize"

    graph.add_node("write", writer_agent)
    graph.add_node("verify", verification_agent)
    graph.add_node("repair", repair_agent)
    graph.add_node("finalize", finalize_agent)
    graph.add_edge(START, "write")
    graph.add_edge("write", "verify")
    graph.add_conditional_edges("verify", route_after_verify, {"repair": "repair", "finalize": "finalize"})
    graph.add_edge("repair", "write")
    graph.add_edge("finalize", END)
    return graph.compile()
