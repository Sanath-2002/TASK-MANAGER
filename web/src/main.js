import { createClient } from "@supabase/supabase-js";
import "./style.css";

const config = { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
const supabaseReady = Boolean(config.url && config.key);
const supabase = supabaseReady ? createClient(config.url, config.key) : null;
const $ = selector => document.querySelector(selector);
const list = $("#task-list");
const form = $("#add-form");
const input = $("#new-task");
const searchInput = $("#task-search");
const toast = $("#toast");
const toastMessage = $("#toast-message");
const toastAction = $("#toast-action");
const taskDialog = $("#task-dialog");
const projectDialog = $("#project-dialog");
const filterButtons = [...document.querySelectorAll(".filter")];

let tasks = [];
let projects = [];
let activeFilter = "all";
let activeProject = null;
let toastTimer;

function notify(message, action = null) {
  toastMessage.textContent = message;
  toastAction.hidden = !action;
  toastAction.textContent = action?.label || "";
  toastAction.onclick = action ? async () => { toast.classList.remove("show"); await action.run(); } : null;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function setConnection(connected, message = connected ? "Saved" : "Connection issue") {
  $("#api-status").classList.toggle("error", !connected);
  $("#api-status-text").textContent = message;
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayString() {
  return dateInputValue(new Date());
}

function matchesView(task) {
  const today = todayString();
  if (activeProject && task.project_id !== activeProject) return false;
  if (activeFilter === "done") return task.done;
  if (activeFilter === "active") return !task.done;
  if (activeFilter === "today") return !task.done && task.due_date === today;
  if (activeFilter === "upcoming") return !task.done && task.due_date > today;
  if (activeFilter === "overdue") return !task.done && task.due_date && task.due_date < today;
  return true;
}

function dueLabel(dueDate) {
  if (!dueDate) return "";
  const today = todayString();
  if (dueDate < today) return `Overdue · ${new Date(`${dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (dueDate === today) return "Today";
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dueDate === dateInputValue(tomorrow)) return "Tomorrow";
  return new Date(`${dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function taskOrder(a, b) {
  if (a.done !== b.done) return Number(a.done) - Number(b.done);
  if (a.due_date !== b.due_date) return (a.due_date || "9999").localeCompare(b.due_date || "9999");
  const rank = { high: 0, medium: 1, low: 2, none: 3 };
  return rank[a.priority] - rank[b.priority] || a.created_at.localeCompare(b.created_at);
}

function render() {
  const openTasks = tasks.filter(task => !task.done);
  const today = todayString();
  $("#count-all").textContent = tasks.length;
  $("#count-today").textContent = openTasks.filter(task => task.due_date === today).length;
  $("#count-upcoming").textContent = openTasks.filter(task => task.due_date > today).length;
  $("#count-overdue").textContent = openTasks.filter(task => task.due_date && task.due_date < today).length;
  $("#count-active").textContent = openTasks.length;
  $("#count-done").textContent = tasks.length - openTasks.length;
  filterButtons.forEach(button => button.setAttribute("aria-pressed", String(!activeProject && button.dataset.filter === activeFilter)));

  const activeProjectRecord = projects.find(project => project.id === activeProject);
  $("#view-heading").textContent = activeProjectRecord?.name || ({ all: "All tasks", today: "Today", upcoming: "Upcoming", overdue: "Overdue", active: "To do", done: "Completed" }[activeFilter]);
  renderProjects();
  renderProjectOptions();

  const query = searchInput.value.trim().toLocaleLowerCase();
  const visible = tasks.filter(task => matchesView(task) && `${task.title} ${task.description || ""}`.toLocaleLowerCase().includes(query)).sort(taskOrder);
  $("#task-summary").textContent = query ? `${visible.length} matching ${visible.length === 1 ? "task" : "tasks"}` : `${visible.length} ${visible.length === 1 ? "task" : "tasks"}`;
  list.replaceChildren();

  if (!visible.length) {
    const item = document.createElement("li");
    item.className = "empty-state";
    const title = query ? "No matching tasks" : activeFilter === "today" ? "Nothing due today" : activeFilter === "upcoming" ? "No upcoming tasks" : activeFilter === "overdue" ? "Nothing overdue" : activeFilter === "done" ? "No completed tasks" : "No tasks yet";
    const detail = query ? "Try a different search." : title === "No tasks yet" ? "Add a task above to get started." : "Tasks will show up here when they match this view.";
    item.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
    list.append(item);
  } else visible.forEach(task => list.append(createTaskRow(task)));
}

function renderProjects() {
  const nav = $("#project-list");
  nav.replaceChildren();
  for (const project of projects) {
    const row = document.createElement("div");
    row.className = "project-row";
    const select = document.createElement("button");
    select.type = "button";
    select.className = `project-filter${activeProject === project.id ? " selected" : ""}`;
    select.setAttribute("aria-pressed", String(activeProject === project.id));
    const dot = document.createElement("span");
    dot.className = "project-dot";
    const name = document.createElement("span");
    name.className = "project-name";
    name.textContent = project.name;
    const count = document.createElement("span");
    count.className = "filter-count";
    count.textContent = tasks.filter(task => task.project_id === project.id && !task.done).length;
    select.append(dot, name, count);
    select.addEventListener("click", () => { activeProject = project.id; activeFilter = "all"; render(); });
    const actions = document.createElement("div");
    actions.className = "project-actions";
    actions.append(makeIconButton("Edit project", "✎", () => openProjectEditor(project)), makeIconButton("Delete project", "×", () => deleteProject(project)));
    row.append(select, actions);
    nav.append(row);
  }
}

function renderProjectOptions(selected = "") {
  const select = $("#task-project");
  const previous = selected || select.value;
  select.replaceChildren(new Option("No project", ""));
  projects.forEach(project => select.add(new Option(project.name, project.id)));
  if (projects.some(project => project.id === previous)) select.value = previous;
}

function makeIconButton(label, symbol, action, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `icon-button ${className}`.trim();
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = symbol;
  button.addEventListener("click", action);
  return button;
}

function createTaskRow(task) {
  const row = document.createElement("li");
  row.className = `task-row${task.done ? " done" : ""}`;
  const checkLabel = document.createElement("label");
  checkLabel.className = "check-wrap";
  checkLabel.setAttribute("aria-label", task.done ? `Mark ${task.title} as to do` : `Mark ${task.title} as done`);
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.addEventListener("change", () => updateTask(task.id, { ...task, done: checkbox.checked }));
  const checkmark = document.createElement("span");
  checkmark.className = "checkmark";
  checkmark.textContent = "✓";
  checkLabel.append(checkbox, checkmark);

  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("button");
  title.type = "button";
  title.className = "task-title";
  title.textContent = task.title;
  title.addEventListener("click", () => openTaskEditor(task));
  body.append(title);
  const meta = document.createElement("div");
  meta.className = "task-meta";
  const project = projects.find(item => item.id === task.project_id);
  if (project) meta.append(makeBadge(project.name, "project-badge"));
  if (task.due_date) meta.append(makeBadge(dueLabel(task.due_date), `due-badge${!task.done && task.due_date < todayString() ? " overdue" : ""}`));
  if (task.priority && task.priority !== "none") meta.append(makeBadge(`${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`, `priority-badge ${task.priority}`));
  if ((task.subtask_count || 0) > 0) meta.append(makeBadge(`${task.subtask_done || 0}/${task.subtask_count} subtasks`, "subtask-badge"));
  if (meta.childElementCount) body.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(makeIconButton("Edit task", "✎", () => openTaskEditor(task)), makeIconButton("Delete task", "×", () => deleteTask(task), "delete"));
  row.append(checkLabel, body, actions);
  return row;
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `task-badge ${className}`;
  badge.textContent = text;
  return badge;
}

function openTaskEditor(task = null) {
  $("#task-dialog-title").textContent = task ? "Edit task" : "New task";
  $("#edit-task-id").value = task?.id || "";
  $("#task-title").value = task?.title || "";
  $("#task-notes").value = task?.description || "";
  $("#task-due").value = task?.due_date || "";
  $("#task-priority").value = task?.priority || "none";
  renderProjectOptions(task?.project_id || "");
  $("#subtask-title").value = "";
  renderSubtasks(task?.id || null);
  $("#add-subtask").disabled = !task;
  $("#subtask-title").disabled = !task;
  taskDialog.showModal();
  $("#task-title").focus();
}

async function renderSubtasks(taskId) {
  const nav = $("#subtask-list");
  nav.replaceChildren();
  if (!taskId) {
    $("#subtask-count").textContent = "Save the task first";
    return;
  }
  const { data, error } = await supabase.from("subtasks").select("id,title,done").eq("task_id", taskId).order("created_at");
  if (error) { notify(error.message); return; }
  $("#subtask-count").textContent = `${data.filter(item => item.done).length}/${data.length}`;
  data.forEach(item => {
    const li = document.createElement("li");
    li.className = "subtask-row";
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", async () => {
      const { error: updateError } = await supabase.from("subtasks").update({ done: checkbox.checked }).eq("id", item.id);
      if (updateError) notify(updateError.message); else { refreshSubtaskCount(taskId); }
    });
    const title = document.createElement("span");
    title.textContent = item.title;
    if (item.done) title.classList.add("done");
    label.append(checkbox, title);
    li.append(label, makeIconButton("Delete subtask", "×", async () => {
      const { error: deleteError } = await supabase.from("subtasks").delete().eq("id", item.id);
      if (deleteError) notify(deleteError.message); else { await renderSubtasks(taskId); await refreshTaskSubtaskCounts(); }
    }, "delete"));
    nav.append(li);
  });
}

async function refreshSubtaskCount(taskId) {
  await renderSubtasks(taskId);
  await refreshTaskSubtaskCounts();
}

async function refreshTaskSubtaskCounts() {
  const { data, error } = await supabase.from("subtasks").select("task_id,done");
  if (!error) {
    tasks = tasks.map(task => {
      const items = data.filter(item => item.task_id === task.id);
      return { ...task, subtask_count: items.length, subtask_done: items.filter(item => item.done).length };
    });
    render();
  }
}

async function updateTask(id, values) {
  const payload = { title: values.title, description: values.description || "", done: values.done, priority: values.priority || "none", due_date: values.due_date || null, project_id: values.project_id || null };
  const { data, error } = await supabase.from("tasks").update(payload).eq("id", id).select().single();
  if (error) { setConnection(false); notify(error.message); await loadData(); return false; }
  tasks = tasks.map(task => task.id === id ? { ...task, ...data } : task);
  setConnection(true);
  render();
  return true;
}

async function deleteTask(task) {
  const { data: subtasks } = await supabase.from("subtasks").select("title,done").eq("task_id", task.id);
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) { notify(error.message); return; }
  tasks = tasks.filter(item => item.id !== task.id);
  render();
  notify("Task deleted", { label: "Undo", run: async () => {
    const { data: restored, error: restoreError } = await supabase.from("tasks").insert(taskPayload(task)).select().single();
    if (restoreError) { notify(restoreError.message); return; }
    if (subtasks?.length) {
      const { error: subtaskError } = await supabase.from("subtasks").insert(subtasks.map(item => ({ task_id: restored.id, title: item.title, done: item.done })));
      if (subtaskError) notify(subtaskError.message);
    }
    await loadData();
    notify("Task restored");
  }});
}

function taskPayload(task) {
  return { title: task.title, description: task.description || "", done: task.done, priority: task.priority || "none", due_date: task.due_date || null, project_id: task.project_id || null };
}

function openProjectEditor(project = null) {
  $("#project-dialog-title").textContent = project ? "Edit project" : "New project";
  $("#edit-project-id").value = project?.id || "";
  $("#project-name").value = project?.name || "";
  projectDialog.showModal();
  $("#project-name").focus();
}

async function deleteProject(project) {
  if (!window.confirm(`Delete “${project.name}”? Its tasks will stay in All tasks.`)) return;
  const { error: tasksError } = await supabase.from("tasks").update({ project_id: null }).eq("project_id", project.id);
  if (tasksError) { notify(tasksError.message); return; }
  const { error } = await supabase.from("projects").delete().eq("id", project.id);
  if (error) { notify(error.message); return; }
  if (activeProject === project.id) activeProject = null;
  await loadData();
  notify("Project deleted");
}

async function loadData() {
  const [taskResult, projectResult, subtaskResult] = await Promise.all([
    supabase.from("tasks").select("id,title,description,done,priority,due_date,project_id,created_at,updated_at").order("created_at", { ascending: true }),
    supabase.from("projects").select("id,name,created_at").order("created_at", { ascending: true }),
    supabase.from("subtasks").select("task_id,done"),
  ]);
  const error = taskResult.error || projectResult.error || subtaskResult.error;
  if (error) {
    setConnection(false);
    $("#task-summary").textContent = "Couldn’t load tasks";
    notify(error.message);
    return;
  }
  projects = projectResult.data;
  const counts = new Map();
  subtaskResult.data.forEach(item => {
    const current = counts.get(item.task_id) || { total: 0, done: 0 };
    current.total += 1;
    if (item.done) current.done += 1;
    counts.set(item.task_id, current);
  });
  tasks = taskResult.data.map(task => ({ ...task, subtask_count: counts.get(task.id)?.total || 0, subtask_done: counts.get(task.id)?.done || 0 }));
  setConnection(true);
  render();
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title || !supabase) return;
  const button = form.querySelector("button");
  button.disabled = true;
  const { error } = await supabase.from("tasks").insert({ title, project_id: activeProject || null });
  if (error) { notify(error.message); setConnection(false); }
  else { input.value = ""; activeFilter = "all"; setConnection(true); await loadData(); input.focus(); }
  button.disabled = false;
});

$("#task-editor").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("#edit-task-id").value;
  const values = { title: $("#task-title").value.trim(), description: $("#task-notes").value.trim(), done: tasks.find(task => task.id === id)?.done || false, due_date: $("#task-due").value || null, priority: $("#task-priority").value, project_id: $("#task-project").value || null };
  if (!values.title) return;
  if (id) {
    const saved = await updateTask(id, values);
    if (!saved) return;
  }
  else {
    const { error } = await supabase.from("tasks").insert(values);
    if (error) { notify(error.message); setConnection(false); return; }
    await loadData();
  }
  taskDialog.close();
  notify(id ? "Task saved" : "Task added");
});

$("#add-subtask").addEventListener("click", async () => {
  const taskId = $("#edit-task-id").value;
  const title = $("#subtask-title").value.trim();
  if (!taskId || !title) return;
  const { error } = await supabase.from("subtasks").insert({ task_id: taskId, title });
  if (error) { notify(error.message); return; }
  $("#subtask-title").value = "";
  await refreshSubtaskCount(taskId);
});

$("#subtask-title").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); $("#add-subtask").click(); } });

$("#project-editor").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("#edit-project-id").value;
  const name = $("#project-name").value.trim();
  const query = id ? supabase.from("projects").update({ name }).eq("id", id) : supabase.from("projects").insert({ name });
  const { error } = await query;
  if (error) { notify(error.message); return; }
  projectDialog.close();
  await loadData();
  notify(id ? "Project saved" : "Project added");
});

$("#add-project").addEventListener("click", () => openProjectEditor());
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
filterButtons.forEach(button => button.addEventListener("click", () => { activeProject = null; activeFilter = button.dataset.filter; render(); }));
searchInput.addEventListener("input", render);
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) { event.preventDefault(); searchInput.focus(); }
  if (event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) { event.preventDefault(); input.focus(); }
  if (event.key === "Escape" && document.activeElement === searchInput) { searchInput.value = ""; searchInput.blur(); render(); }
});

async function startApp() {
  if (!supabaseReady) {
    setConnection(false, "Setup needed");
    $("#task-summary").textContent = "Connect a database to save tasks";
    notify("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel.");
    form.querySelector("button").disabled = true;
    input.disabled = true;
    $("#add-project").disabled = true;
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) { notify(error.message); setConnection(false); form.querySelector("button").disabled = true; $("#add-project").disabled = true; return; }
  if (!data.session) {
    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) { notify("Guest access failed. Enable anonymous sign-ins in Supabase."); setConnection(false); form.querySelector("button").disabled = true; $("#add-project").disabled = true; return; }
  }
  await loadData();
}

startApp();
