export type TaskHorizon = "today" | "week" | "month" | "year" | "life";

export type Task = {
  id: string;
  text: string;
  horizon: TaskHorizon;
  periodKey: string;
};
