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
const filterButtons = [...document.querySelectorAll(".filter")];
const supabaseReady = Boolean(config.url && config.key);
const supabase = supabaseReady ? createClient(config.url, config.key) : null;

let tasks = [];
let activeFilter = "all";
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setConnection(connected, message = connected ? "Your list is saved" : "Connection issue") {
  const indicator = document.querySelector("#api-status");
  indicator.classList.toggle("error", !connected);
  document.querySelector("#api-status-text").textContent = message;
}

function render() {
  const completeCount = tasks.filter(task => task.done).length;
  const remaining = tasks.length - completeCount;
  document.querySelector("#progress-count").textContent = `${completeCount} / ${tasks.length} done`;
  document.querySelector("#progress-title").textContent = tasks.length === 0 ? "A fresh start" : remaining === 0 ? "Look at you go!" : "You're making progress";
  document.querySelector("#progress-caption").textContent = tasks.length === 0 ? "Add a task and get going." : remaining === 0 ? "Everything on your list is complete." : `${remaining} ${remaining === 1 ? "task" : "tasks"} left to tackle.`;
  document.querySelector("#task-summary").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} on your list`;

  filterButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === activeFilter)));
  const visibleTasks = tasks.filter(task => activeFilter === "all" || (activeFilter === "done" ? task.done : !task.done));
  list.replaceChildren();

  if (visibleTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "▤";
    const heading = document.createElement("strong");
    const message = document.createElement("span");
    if (tasks.length === 0) {
      heading.textContent = "Your list is ready when you are";
      message.textContent = "Add your first task above to get started.";
    } else if (activeFilter === "done") {
      heading.textContent = "Nothing completed just yet";
      message.textContent = "Finish a task and it will show up here.";
    } else {
      heading.textContent = "You're all caught up";
      message.textContent = "Everything is done. Enjoy the breathing room.";
    }
    empty.append(icon, heading, message);
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
  editForm.append(editInput, save);
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
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    setConnection(false);
    notify(error.message);
    return;
  }
  tasks = tasks.filter(task => task.id !== id);
  setConnection(true);
  render();
  notify("Task removed.");
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
  setConnection(true, "Private guest list");
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
    setConnection(true, "Private guest list");
    render();
    input.focus();
  }
  button.disabled = false;
});

filterButtons.forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  render();
}));

startApp();
