import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoModeProvider, useDemoMode } from "./DemoModeContext";
import { useUpdateSettings } from "@/hooks/useData";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

beforeEach(() => localStorage.setItem("vlife-demo-mode", "true"));
afterEach(() => { cleanup(); localStorage.clear(); });

function mount() {
  const client = new QueryClient();
  return renderHook(() => ({ demo: useDemoMode(), updateSettings: useUpdateSettings() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><DemoModeProvider>{children}</DemoModeProvider></QueryClientProvider>
    ),
  });
}

describe("demo record shapes", () => {
  it("saves settings through the real settings hook and preserves the object and other tables", async () => {
    const { result } = mount();
    const todos = result.current.demo.demoData.todos;
    const id = result.current.demo.demoData.settings.id;
    await act(async () => { await result.current.updateSettings.mutateAsync({ display_name: "新名字" }); });
    expect(result.current.demo.demoData.settings).toMatchObject({ id, display_name: "新名字" });
    expect(Array.isArray(result.current.demo.demoData.settings)).toBe(false);
    expect(result.current.demo.demoData.todos).toBe(todos);
  });

  it("resets a deleted settings singleton without changing the table shape", () => {
    const { result } = mount();
    const settings = result.current.demo.demoData.settings;
    const todos = result.current.demo.demoData.todos;
    act(() => result.current.demo.deleteRecord("settings", settings.id));
    expect(result.current.demo.demoData.settings).toMatchObject({ id: settings.id });
    expect(Array.isArray(result.current.demo.demoData.settings)).toBe(false);
    expect(result.current.demo.demoData.todos).toBe(todos);
  });

  it("treats adding settings as a singleton upsert instead of an array insert", () => {
    const { result } = mount();
    const id = result.current.demo.demoData.settings.id;
    act(() => { result.current.demo.addRecord("settings", { display_name: "通过新增保存" }); });
    expect(result.current.demo.demoData.settings).toMatchObject({ id, display_name: "通过新增保存" });
    expect(Array.isArray(result.current.demo.demoData.settings)).toBe(false);
  });

  it("still creates, updates and deletes ordinary array records", () => {
    const { result } = mount();
    const originalCount = result.current.demo.demoData.todos.length;
    act(() => { result.current.demo.addRecord("todos", { id: "new-todo", title: "before" }); });
    expect(result.current.demo.demoData.todos).toHaveLength(originalCount + 1);
    act(() => result.current.demo.updateRecord("todos", "new-todo", { title: "after" }));
    expect(result.current.demo.demoData.todos.find((todo) => todo.id === "new-todo")?.title).toBe("after");
    act(() => result.current.demo.deleteRecord("todos", "new-todo"));
    expect(result.current.demo.demoData.todos).toHaveLength(originalCount);
  });
});

it('records completion transitions without inventing dates for legacy completed todos', () => {
  const { result } = mount();
  act(() => { result.current.demo.addRecord('todos', { id:'timestamp-todo',title:'test',kind:'once',is_completed:false }); });
  const todo = () => result.current.demo.demoData.todos.find(t => t.id === 'timestamp-todo');
  act(() => result.current.demo.updateRecord('todos','timestamp-todo',{is_completed:true}));
  const completedAt = todo().completed_at;
  expect(completedAt).toEqual(expect.any(String));
  act(() => result.current.demo.updateRecord('todos','timestamp-todo',{is_completed:true,completed_at:'fake'}));
  expect(todo().completed_at).toBe(completedAt);
  act(() => result.current.demo.updateRecord('todos','timestamp-todo',{is_completed:false}));
  expect(todo().completed_at).toBeNull();
  act(() => result.current.demo.updateRecord('todos','timestamp-todo',{is_completed:true}));
  expect(todo().completed_at).toEqual(expect.any(String));
  // Simulate pre-migration storage rather than creating a newly completed record.
  todo().completed_at = null;
  act(() => result.current.demo.updateRecord('todos','timestamp-todo',{is_completed:true}));
  expect(todo().completed_at).toBeNull();
});
