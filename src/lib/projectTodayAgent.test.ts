import { expect, it, vi } from "vitest";
import { createDemoDataStore } from "@/data/demoSeed";
import { existingTodayCommand, projectTodayRequest } from "./projectTodayAgent";

it("recognizes an existing task with an optional spoken project name", () => {
  expect(existingTodayCommand("把修改实验部分加入今天")).toEqual({title:"修改实验部分"});
  expect(existingTodayCommand("帮我把毕业论文项目里的修改实验部分安排到今天")).toEqual({title:"修改实验部分",project_name:"毕业论文"});
  expect(existingTodayCommand("明天再考虑修改实验部分")).toBeNull();
});
it("requires a unique original card and keeps retries on its ID", async () => {
  const data = createDemoDataStore();
  const [one, two] = data.projects;
  const sample = data.project_tasks[0];
  data.project_tasks = [one, two].map(p => ({...sample, id:p.id+"-card", project_id:p.id, status:"todo", type:"task",title:"修改实验部分"}));
  const arrange = vi.fn((id:string,day:string) => { data.project_tasks.find(row => row.id === id)!.today_date=day; });
  const demo = {data, day:"2026-11-04", arrange};
  const request = {title:"修改实验部分"};
  expect((await projectTodayRequest(request,true,demo)).status).toBe("ambiguous");
  expect((await projectTodayRequest({...request,title:"不存在"},true,demo)).status).toBe("not_found");
  const scoped = {...request,project_name:two.name};
  expect((await projectTodayRequest(scoped,false,demo)).status).toBe("matched");
  expect(arrange).not.toHaveBeenCalled();
  expect((await projectTodayRequest(scoped,true,demo)).status).toBe("arranged");
  expect((await projectTodayRequest(scoped,true,demo)).status).toBe("already_arranged");
  expect(arrange).toHaveBeenCalledTimes(1);
  expect(arrange).toHaveBeenCalledWith(two.id+"-card", demo.day);
});
