import { createClient } from "@supabase/supabase-js";
import "./style.css";

const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const list = document.querySelector("#task-list");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-task");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#task-search");
const toastMessage = document.querySelector("#toast-message");
const toastAction = document.querySelector("#toast-action");
const filterButtons = [...document.querySelectorAll(".filter")];
const supabaseReady = Boolean(config.url && config.key);
const supabase = supabaseReady ? createClient(config.url, config.key) : null;

let tasks = [];
let activeFilter = "all";
let toastTimer;

function notify(message, action = null) {
  toastMessage.textContent = message;
  toastAction.hidden = !action;
  toastAction.textContent = action?.label || "";
  toastAction.onclick = action ? async () => { toast.classList.remove("show"); await action.run(); } : null;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setConnection(connected, message = connected ? "Saved" : "Connection issue") {
  const indicator = document.querySelector("#api-status");
  indicator.classList.toggle("error", !connected);
  document.querySelector("#api-status-text").textContent = message;
}

function render() {
  const completeCount = tasks.filter(task => task.done).length;
  const remaining = tasks.length - completeCount;
  const progress = tasks.length ? Math.round((completeCount / tasks.length) * 100) : 0;
  document.querySelector("#progress-count").textContent = `${completeCount} / ${tasks.length} done`;
  document.querySelector("#progress-bar").style.width = `${progress}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", progress);
  document.querySelector("#progress-title").textContent = "Task completion";
  document.querySelector("#progress-caption").textContent = tasks.length ? `${completeCount} completed · ${remaining} remaining` : "No completed tasks";
  document.querySelector("#count-all").textContent = tasks.length;
  document.querySelector("#count-active").textContent = remaining;
  document.querySelector("#count-done").textContent = completeCount;
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const filterNames = { all: "All tasks", active: "To do", done: "Completed" };
  document.querySelector("#list-heading").textContent = filterNames[activeFilter];

  filterButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === activeFilter)));
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleTasks = tasks.filter(task => (activeFilter === "all" || (activeFilter === "done" ? task.done : !task.done)) && task.title.toLocaleLowerCase().includes(query));
  document.querySelector("#task-summary").textContent = query ? `${visibleTasks.length} matching ${visibleTasks.length === 1 ? "task" : "tasks"}` : `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;
  list.replaceChildren();

  if (visibleTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "▤";
    const message = document.createElement("div");
    const heading = document.createElement("strong");
    const detail = document.createElement("span");
    if (query) {
      heading.textContent = "No matching tasks";
      detail.textContent = "Try a different search term.";
    } else if (tasks.length === 0) {
      heading.textContent = "No tasks yet";
      detail.textContent = "Add your first task using the field above.";
    } else if (activeFilter === "done") {
      heading.textContent = "No completed tasks";
      detail.textContent = "Completed tasks will appear here.";
    } else {
      heading.textContent = "All tasks are complete";
      detail.textContent = "Switch to Completed to see them.";
    }
    message.append(heading, detail);
    empty.append(icon, message);
    list.append(empty);
    return;
  }

  visibleTasks.forEach(task => list.append(createTaskRow(task)));
}

function createTaskRow(task) {
  const row = document.createElement("li");
  row.className = `task-row${task.done ? " done" : ""}`;
  const check = document.createElement("label");
  check.className = "check-wrap";
  check.setAttribute("aria-label", task.done ? `Mark ${task.title} as to do` : `Mark ${task.title} as done`);
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.addEventListener("change", () => saveTask(task.id, { title: task.title, done: checkbox.checked }));
  const mark = document.createElement("span");
  mark.className = "checkmark";
  mark.textContent = "✓";
  check.append(checkbox, mark);
  row.append(check);

  const title = document.createElement("span");
  title.className = "task-text";
  title.textContent = task.title;
  row.append(title);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.className = "icon-button";
  edit.type = "button";
  edit.setAttribute("aria-label", `Edit ${task.title}`);
  edit.title = "Edit task";
  edit.textContent = "✎";
  edit.addEventListener("click", () => startEditing(row, task));

  const remove = document.createElement("button");
  remove.className = "icon-button delete";
  remove.type = "button";
  remove.setAttribute("aria-label", `Delete ${task.title}`);
  remove.title = "Delete task";
  remove.textContent = "×";
  remove.addEventListener("click", () => deleteTask(task.id));
  actions.append(edit, remove);
  row.append(actions);
  return row;
}

function startEditing(row, task) {
  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  const editInput = document.createElement("input");
  editInput.className = "edit-input";
  editInput.value = task.title;
  editInput.maxLength = 100;
  editInput.required = true;
  editInput.setAttribute("aria-label", "Edit task title");
  const save = document.createElement("button");
  save.className = "save-edit";
  save.textContent = "Save";
  const cancel = document.createElement("button");
  cancel.className = "cancel-edit";
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", render);
  editForm.append(editInput, save, cancel);
  row.replaceChildren(editForm);
  editInput.focus();
  editInput.select();
  editForm.addEventListener("submit", async event => {
    event.preventDefault();
    const title = editInput.value.trim();
    if (title) await saveTask(task.id, { title, done: task.done });
  });
  editInput.addEventListener("keydown", event => {
    if (event.key === "Escape") render();
  });
}

async function saveTask(id, values) {
  const { data, error } = await supabase.from("tasks").update(values).eq("id", id).select().single();
  if (error) {
    setConnection(false);
    notify(error.message);
    await loadTasks();
    return;
  }
  tasks = tasks.map(task => task.id === id ? data : task);
  setConnection(true);
  render();
}

async function deleteTask(id) {
  const removed = tasks.find(task => task.id === id);
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    setConnection(false);
    notify(error.message);
    return;
  }
  tasks = tasks.filter(task => task.id !== id);
  setConnection(true);
  render();
  notify("Task deleted", { label: "Undo", run: async () => {
    const { data, error: restoreError } = await supabase.from("tasks").insert({ title: removed.title, done: removed.done }).select().single();
    if (restoreError) {
      notify(restoreError.message);
      return;
    }
    tasks.push(data);
    setConnection(true, "Saved");
    render();
    notify("Task restored");
  }});
}

async function loadTasks() {
  const { data, error } = await supabase.from("tasks").select("id,title,done,created_at").order("created_at", { ascending: true });
  if (error) {
    setConnection(false);
    document.querySelector("#task-summary").textContent = "Couldn't load your tasks";
    notify("We couldn't load your list. Please refresh and try again.");
    return;
  }
  tasks = data;
  setConnection(true);
  render();
}

async function startApp() {
  if (!supabaseReady) {
    setConnection(false, "Setup needed");
    document.querySelector("#task-summary").textContent = "Connect your free database to get started";
    notify("Add your Supabase URL and publishable key to web/.env.local.");
    form.querySelector("button").disabled = true;
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    setConnection(false);
    notify(sessionError.message);
    return;
  }
  if (!sessionData.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setConnection(false);
      document.querySelector("#task-summary").textContent = "Couldn't start your private task list";
      notify("Guest access is unavailable. Check that anonymous sign-ins are enabled in Supabase.");
      return;
    }
  }
  setConnection(true, "Saved");
  await loadTasks();
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title || !supabase) return;
  const button = form.querySelector("button");
  button.disabled = true;
  const { data, error } = await supabase.from("tasks").insert({ title }).select().single();
  if (error) {
    setConnection(false);
    notify(error.message);
  } else {
    tasks.push(data);
    input.value = "";
    activeFilter = "all";
    setConnection(true, "Saved");
    render();
    input.focus();
  }
  button.disabled = false;
});

filterButtons.forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  render();
}));

searchInput.addEventListener("input", render);
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    searchInput.blur();
    render();
  }
});

startApp();
